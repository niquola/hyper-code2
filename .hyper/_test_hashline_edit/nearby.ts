export function greet(name?: string) {
  const user = normalizeUser(name);
  return "Hello, " + user + "!";
}
