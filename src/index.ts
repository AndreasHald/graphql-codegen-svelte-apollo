import { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { concatAST, OperationDefinitionNode, Kind } from "graphql";
import { pascalCase } from "pascal-case";
import { camelCase } from "camel-case";

module.exports = {
  plugin: (schema, documents, config, info) => {
    const allAst = concatAST(documents.map((d) => d.document));
    const operations = allAst.definitions.filter(
      (d) => d.kind === Kind.OPERATION_DEFINITION
    ) as OperationDefinitionNode[];

    const operationImport = `${
      operations.some((op) => op.operation == "query") ? "query, " : ""
    }${
      operations.some((op) => op.operation == "mutation") ? "mutation, " : ""
    }${
      operations.some((op) => op.operation == "subscription")
        ? "subscription, "
        : ""
    }`.slice(0, -2);

    const imports = [
      config.clientPath
        ? `import client from "${config.clientPath}";`
        : `import { ApolloClient } from "apollo-client";`,
      `import { ${operationImport} } from "svelte-apollo";`,
      `import { writable } from "svelte/store";`,
      `import gql from "graphql-tag"`,
    ];
    // const docs = documents.filter(d => d.document.definitions.)

    const ops = operations
      .map((o) => {
        const dsl = `export const ${o.name.value}Doc = gql\`${
          documents.find((d) =>
            d.rawSDL.includes(`${o.operation} ${o.name.value}`)
          ).rawSDL
        }\``;
        const op = `${o.name.value}${pascalCase(o.operation)}`;
        const opv = `${op}Variables`;
        // const doc = `const ${o.name.value}Doc = ${o}`
        const operation = `export const ${o.name.value} = (${
          config.clientPath ? "" : "client: ApolloClient, "
        }variables: ${opv}) =>
  ${o.operation}<${op}, any, ${opv}>(client, {
    ${o.operation}: ${o.name.value}Doc,
    variables
  })`;
        let statelessOperation = "";
        if (
          config.clientPath &&
          !o.variableDefinitions.length &&
          o.operation != "mutation"
        ) {
          statelessOperation = `export const ${camelCase(
            o.name.value
          )} = writable<${op}>({}, (set) => {
                      const p = ${o.name.value}({})
                      p.subscribe((v) => {
                        v["then"](res => {
                          set(res.data || {})
                        })
                      })
                    })`;
        }
        return dsl + "\n" + operation + "\n" + statelessOperation;
      })
      .join("\n");
    return {
      prepend: imports,
      content: ops,
    };
  },
  validate: (schema, documents, config, outputFile, allPlugins) => {
    if (!config.clientPath) {
      console.warn("Client path is not present in config");
    }
  },
} as CodegenPlugin;
