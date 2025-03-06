import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

import { TComplexTypeDefinition, TFunctionTypeInfo } from '@/src/language';

/**
 * Given a file and a function name, returns type info for:
 *   - parameters
 *   - return type
 *   - local variables (declared inside the function body)
 *
 * Instead of returning built-in types as 'string', 'number', etc.,
 * we skip them unless they're part of a complex type’s property.
 */
export function collectFunctionTypes(
    filePath: string,
    functionName: string
): TFunctionTypeInfo | null {
    const program = ts.createProgram([filePath], {
        skipLibCheck: true,
        strict: false,
        target: ts.ScriptTarget.Latest,
        allowJs: true,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(path.resolve(filePath));

    if (!sourceFile) {
        throw new Error(`Could not open file: ${filePath}`);
    }

    // Find the function node
    const functionNode = findFunctionByName(sourceFile, functionName);
    if (!functionNode) {
        console.warn(`Function "${functionName}" not found in ${filePath}`);
        return null;
    }

    return getFunctionTypeInfo(functionNode, checker);
}

/**
 * Recursively searches the AST for a function-like node with the given name.
 */
export function findFunctionByName(
    node: ts.Node,
    functionName: string
): ts.FunctionLikeDeclarationBase | undefined {
    let found: ts.FunctionLikeDeclarationBase | undefined;

    node.forEachChild((child) => {
        if (isNamedFunctionLike(child, functionName)) {
            found = child as ts.FunctionLikeDeclarationBase;
            return;
        }
        if (!found) {
            found = findFunctionByName(child, functionName);
        }
    });

    return found;
}

export function isNamedFunctionLike(node: ts.Node, name: string): boolean {
    // function myFunc() {}
    if (ts.isFunctionDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
            return node.name.text === name;
        }
        return false;
    }

    // class X { myMethod() {} }
    if (ts.isMethodDeclaration(node)) {
        if (node.name && ts.isIdentifier(node.name)) {
            return node.name.text === name;
        }
        return false;
    }

    // const myFunc = function() {} / () => {}
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
            return node.parent.name.text === name;
        }
        return false;
    }

    return false;
}

/**
 * Gathers "complex" type info for:
 *   - parameters
 *   - return type
 *   - local variables
 *
 * We skip built-in types (string, number, boolean, etc.) by returning `null`.
 * For non-builtin (object/union) types, we build a recursive definition.
 */
export function getFunctionTypeInfo(
    func: ts.FunctionLikeDeclarationBase,
    checker: ts.TypeChecker
): TFunctionTypeInfo {
    const parameters: Array<{ name: string; type: TComplexTypeDefinition | null }> = [];
    const localVariables: Array<{ name: string; type: TComplexTypeDefinition | null }> = [];
    let returnType: TComplexTypeDefinition | null = null;

    // 1) Get the function's type
    const funcType = checker.getTypeAtLocation(func);
    const signatures = funcType.getCallSignatures();
    if (signatures.length > 0) {
        const signature = signatures[0];

        // Return type
        const tsReturnType = signature.getReturnType();
        returnType = collectComplexTypeDefinition(tsReturnType, checker);

        // Parameter types
        for (const paramSymbol of signature.getParameters()) {
            const decls = paramSymbol.getDeclarations();
            if (!decls || decls.length === 0) continue;

            const paramDecl = decls[0];
            const paramType = checker.getTypeOfSymbolAtLocation(paramSymbol, paramDecl);

            parameters.push({
                name: paramSymbol.getName(),
                type: collectComplexTypeDefinition(paramType, checker),
            });
        }
    }

    // 2) Local variables in the function's body
    if (func.body && ts.isBlock(func.body)) {
        for (const statement of func.body.statements) {
            if (ts.isVariableStatement(statement)) {
                for (const decl of statement.declarationList.declarations) {
                    const varName = decl.name.getText();
                    const varType = checker.getTypeAtLocation(decl.name);

                    localVariables.push({
                        name: varName,
                        type: collectComplexTypeDefinition(varType, checker),
                    });
                }
            }
        }
    }

    return { parameters, returnType, localVariables };
}

/**
 * Recursively collect a "complex" type definition, skipping built-in types.
 *
 * Returns `null` if the type is built-in or otherwise "simple".
 * Otherwise returns a nested structure describing the properties or union members.
 */
export function collectComplexTypeDefinition(
    type: ts.Type,
    checker: ts.TypeChecker,
    visited = new Set<number>() // track type IDs to avoid infinite loops
): TComplexTypeDefinition | null {
    // If it's a built-in (string, number, boolean, etc.), skip.
    if (isBuiltinType(type)) {
        return null;
    }

    // If we've already visited this type, avoid looping.
    const typeId = (type as any).id;
    if (typeId && visited.has(typeId)) {
        // You might choose to return null or a special placeholder for recursive references.
        // We'll just return null for simplicity.
        return null;
    }
    visited.add(typeId);

    // If it's a union type, collect each subtype.
    if (type.isUnion()) {
        const unionDefs = type.types.map((t) =>
            collectComplexTypeDefinition(t, checker, visited)
        );
        return {
            kind: 'union',
            types: unionDefs,
        };
    }

    // If it's an object or interface/class type, gather its properties.
    if (isObjectOrInterfaceType(type)) {
        // If there's a symbol, we can get a name (e.g., interface name).
        const symbol = type.getSymbol();
        const name = symbol?.getName();

        const propDefs: Record<string, TComplexTypeDefinition | null> = {};
        const properties = checker.getPropertiesOfType(type);
        for (const prop of properties) {
            if (!prop.valueDeclaration || !prop.declarations?.[0]) continue;
            const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration || prop.declarations?.[0]);
            propDefs[prop.getName()] = collectComplexTypeDefinition(propType, checker, visited);
        }

        return {
            kind: 'object',
            name: name && !isDefaultTsName(name) ? name : undefined,
            properties: propDefs,
        };
    }

    // Otherwise, return null for unhandled/other types (e.g. type alias, intersection, etc.)
    // You can expand this logic as needed for your use-case.
    return null;
}

/**
 * Checks if a type is one of the common built-in or literal types
 * that we do not want to include in our "complex" definitions.
 */
export function isBuiltinType(type: ts.Type): boolean {
    const flags = type.getFlags();

    // Some typical flags:
    //  - ts.TypeFlags.String, Number, Boolean, Any, Unknown, Never, Void, etc.
    //  - ts.TypeFlags.BooleanLike, NumberLike, StringLike if you want to be broader.
    //  - For literal types, e.g. TypeFlags.StringLiteral.

    if (
        flags & ts.TypeFlags.String ||
        flags & ts.TypeFlags.Number ||
        flags & ts.TypeFlags.Boolean ||
        flags & ts.TypeFlags.Any ||
        flags & ts.TypeFlags.Unknown ||
        flags & ts.TypeFlags.Never ||
        flags & ts.TypeFlags.Void ||
        flags & ts.TypeFlags.Undefined ||
        flags & ts.TypeFlags.Null ||
        flags & ts.TypeFlags.BigInt ||
        flags & ts.TypeFlags.ESSymbol
    ) {
        return true;
    }

    // If it's a literal type (e.g. "foo"), skip it.
    if (flags & ts.TypeFlags.StringLiteral) {
        return true;
    }
    if (flags & ts.TypeFlags.NumberLiteral) {
        return true;
    }
    if (flags & ts.TypeFlags.BooleanLiteral) {
        return true;
    }

    return false;
}

/**
 * Checks if the type is an object or interface (non-null), including class or array.
 */
export function isObjectOrInterfaceType(type: ts.Type): boolean {
    if (!(type.getFlags() & ts.TypeFlags.Object)) {
        return false;
    }
    // Could refine further by checking `objectFlags` if needed.
    return true;
}

/**
 * Some TS symbols come with default names like '__object' or 'Object'.
 * We can optionally filter them out or rename them.
 */
export function isDefaultTsName(name: string): boolean {
    // You can adapt or remove logic here as needed.
    return name.startsWith('__') || name === 'Object';
}