/**
 * Parse --town={id} from CLI args.
 */
export function parseTownArg(argv: string[] = process.argv): string | null {
  for (const arg of argv) {
    if (arg.startsWith("--town=")) {
      return arg.slice("--town=".length).trim() || null;
    }
  }
  return null;
}

export function requireTownArg(argv: string[] = process.argv): string {
  const town = parseTownArg(argv);
  if (!town) {
    console.error("Usage: pass --town={municipality-id}");
    process.exit(1);
  }
  return town;
}
