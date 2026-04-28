export type PasswordOpts = {
  length?: number;       // default 16
  symbols?: boolean;     // include !@#$%^&*…  default true
  numbers?: boolean;     // include digits         default true
  uppercase?: boolean;   // include A-Z            default true
};