import ts from 'typescript';
import { ObjectUpdate } from './../types';

const copyWithSpread = `
const _Utils_update = (oldRecord, updatedFields) => {
    var newRecord = {...oldRecord};
    
    for (var key in updatedFields) {
        newRecord[key] = updatedFields[key];
    }
    return newRecord;
}
`;

const spreadForBoth = `
const _Utils_update = (oldRecord, updatedFields) => ({...oldRecord, ...updatedFields});
}
`;

const assign = `
const _Utils_update = (oldRecord, updatedFields) => (Object.assign({}, oldRecord, updatedFields));
}
`;

export const extractAstFromCode = (sourceText: string): ts.Node => {
  const source = ts.createSourceFile('bla', sourceText, ts.ScriptTarget.ES2018);
  return source.statements[0];
};

export const createReplaceUtilsUpdateWithObjectSpread = (
  kind: ObjectUpdate
): ts.TransformerFactory<ts.SourceFile> => context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      // detects function f(..){..}
      if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === '_Utils_update'
      ) {
        switch (kind) {
          case ObjectUpdate.UseSpreadForUpdateAndOriginalRecord:
            return extractAstFromCode(spreadForBoth);
          case ObjectUpdate.UseSpreadOnlyToMakeACopy:
            return extractAstFromCode(copyWithSpread);
          case ObjectUpdate.UseAssign:
            return extractAstFromCode(assign);
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};

export const convertFunctionExpressionsToArrowFuncs: ts.TransformerFactory<ts.SourceFile> = context => {
  return sourceFile => {
    const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      //   console.log(
      //     `Visiting: ${ts.SyntaxKind[node.kind]} with name ${
      //       (node as any).name?.text
      //     }`
      //   );
      if (
        ts.isFunctionExpression(node) &&
        node.name === undefined &&
        node.body.statements.length === 1
      ) {
        // console.log('$$body', node.body.getText());
        const [returnStatement] = node.body.statements;
        if (
          ts.isReturnStatement(returnStatement) &&
          returnStatement.expression !== undefined
        ) {
          return ts.createArrowFunction(
            undefined,
            undefined,
            node.parameters,
            undefined,
            undefined,
            ts.visitNode(returnStatement.expression, visitor)
            // returnStatement.expression
          );
        }
      }

      if (
        ts.isFunctionDeclaration(node) &&
        node.name !== undefined &&
        node.body !== undefined &&
        node.body.statements.length === 1
      ) {
        // console.log('$$body', node.body.getText());
        const [returnStatement] = node.body.statements;
        if (
          ts.isReturnStatement(returnStatement) &&
          returnStatement.expression !== undefined
        ) {
          return ts.createVariableStatement(
            undefined,
            ts.createVariableDeclarationList(
              [
                ts.createVariableDeclaration(
                  node.name,
                  undefined,
                  ts.createArrowFunction(
                    undefined,
                    undefined,
                    node.parameters,
                    undefined,
                    undefined,
                    ts.visitNode(returnStatement.expression, visitor)
                  )
                ),
              ]
              // ts.NodeFlags.Const
            )
          );
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitNode(sourceFile, visitor);
  };
};
