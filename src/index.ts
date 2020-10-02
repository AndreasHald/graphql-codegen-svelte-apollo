import { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { concatAST, OperationDefinitionNode, Kind } from "graphql";
import { pascalCase } from "pascal-case";
import { camelCase } from "camel-case";

module.exports = {
  plugin: (schema, documents, config, info) => {
    // const typesMap = schema.getTypeMap();
    // return documents
    //     .map((d) => d.document.definitions.map((s) => s.kind))
    //     .join("\n");
    const imports = [
      config.clientPath
        ? `import client from "${config.clientPath}";`
        : `import { ApolloClient } from "apollo-client";`,
      `import {query, mutation, subscription} from "svelte-apollo";`,
    ];
    // keep operations DSL in codegen
    console.log(documents.map((d) => d));
    // const docs = documents.filter(d => d.document.definitions.)
    const allAst = concatAST(documents.map((d) => d.document));
    const operations = (allAst.definitions.filter(
      (d) => d.kind === Kind.OPERATION_DEFINITION
    ) as OperationDefinitionNode[])
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
  ${o.operation}<${op}, any, ${o.name.value}${opv}>(client, {
    ${o.name.value}: ${o.name.value}Doc,
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
                        v.then(res => {
                          set(res.data || {})
                        })
                      })
                    })`;
        }
        return dsl + "\n" + operation + "\n" + statelessOperation;
      })
      .join("\n");
    // return {
    //     prepend: imports,
    //     content: operations,
    // };
    return {
      prepend: imports,
      content: operations,
    };
    // allAst.definitions.map((d) => console.log(d));
    // return Object.keys(typesMap).join("\n");
  },
  validate: (schema, documents, config, outputFile, allPlugins) => {
    console.log(allPlugins, config);
    // allPlugins.map(p => p)
  },
} as CodegenPlugin;
