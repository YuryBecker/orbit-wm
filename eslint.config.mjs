import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';


const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    {
        rules: {
            indent: [
                'error',
                4,
            ],
            'arrow-body-style': [
                'error',
                'as-needed',
            ],
            'arrow-parens': 'off',
            'brace-style': [
                'error',
                '1tbs',
            ],
            'comma-dangle': [
                'error',
                'always-multiline',
            ],
            semi: [
                'error',
                'always',
            ],
            curly: 'off',
            eqeqeq: [
                'error',
                'always',
            ],
            'import/order': [
                'error',
                {
                    groups: [
                        'external',
                        'internal',
                        'parent',
                    ],
                },
            ],
            'import/no-anonymous-default-export': [
                'error',
                {
                    allowArray: true,
                    allowArrowFunction: true,
                    allowAnonymousClass: true,
                    allowAnonymousFunction: true,
                    allowCallExpression: true,
                    allowNew: true,
                    allowLiteral: true,
                    allowObject: true,
                },
            ],
            'linebreak-style': [
                'error',
                'unix',
            ],
            'no-duplicate-imports': 'off',
            'no-eval': 'error',
            'no-fallthrough': 'error',
            'no-null/no-null': 'off',
            'no-trailing-spaces': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'object-curly-spacing': [
                'error',
                'always',
            ],
            'prefer-const': 'error',
            'space-in-parens': [
                'error',
                'never',
            ],
            'spaced-comment': [
                'error',
                'always',
                {
                    markers: [
                        '/',
                    ],
                },
            ],
            'react/boolean-prop-naming': [
                'error',
                {
                    rule: '^(is|has)[A-Z]([A-Za-z0-9]?)+',
                },
            ],
            'react-hooks/exhaustive-deps': 'off',
            'padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: 'import',
                    next: '*',
                },
                {
                    blankLine: 'any',
                    prev: 'import',
                    next: 'import',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            'react/no-unescaped-entities': 'off',
            '@next/next/no-img-element': 'off',
        },
    },
    globalIgnores([
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
    ]),
]);


export default eslintConfig;
