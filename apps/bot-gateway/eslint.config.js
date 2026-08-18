import config from "@effi/eslint-config/base";

export default [...config, { ignores: ["**/.eve/**", "**/.output/**"] }];
