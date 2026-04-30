export default async function (
  _ctx: Context,
  opts?: types.tools.PasswordOpts
) {
  const { length = 16, symbols = true, numbers = true, uppercase = true } = opts ?? {};

  let chars = 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers)   chars += '0123456789';
  if (symbols)   chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);

  const password = Array.from(arr, b => chars[b % chars.length]).join('');
  return { password, length: password.length };
}