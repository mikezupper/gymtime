import tseslint from "typescript-eslint";
import lit from "eslint-plugin-lit";
import wc from "eslint-plugin-wc";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", ".agents/**", "packages/contracts/src/**"] },
  ...tseslint.configs.recommended,
  { files: ["**/*.ts"], plugins: { lit, wc }, rules: {
    ...lit.configs.recommended.rules, ...wc.configs.recommended.rules,
    "@typescript-eslint/no-explicit-any": "error", "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  } },
  { files: ["apps/web/src/**/*.ts", "tools/**/*.ts", "apps/web/scripts/**/*.ts"], rules: {
    "no-restricted-syntax": ["error",
      { selector: "ThrowStatement", message: "Return a typed Effect failure." },
      { selector: "TryStatement", message: "Use an Effect boundary wrapper." },
      { selector: "FunctionDeclaration[async=true], ArrowFunctionExpression[async=true], FunctionExpression[async=true], MethodDefinition[value.async=true]", message: "Compose workflows with Effect." },
      { selector: "CallExpression[callee.object.name='console']", message: "Use Effect logging." },
      { selector: "TSNonNullExpression", message: "Handle absence explicitly." },
    ],
    "no-restricted-imports": ["error", { paths: ["lodash", "ramda"] }],
  } },
);
