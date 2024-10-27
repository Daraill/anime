/**
 * Unpacker Module
 *
 * This module provides functionality to detect and unpack JavaScript code
 * that has been obfuscated using Dean Edwards' P.A.C.K.E.R.
 *
 * Usage:
 *
 * ```typescript
 * import { detect, unpack } from './unpacker';
 *
 * const packedScript = "eval(function(p,a,c,k,e,d){...})";
 *
 * if (detect(packedScript)) {
 *   const unpackedScript = unpack(packedScript);
 *   console.log(unpackedScript);
 * }
 * ```
 */

interface PackerArgs {
  payload: string;
  symtab: string[];
  radix: number;
  count: number;
}

/**
 * Detects if the given source string is packed using P.A.C.K.E.R.
 * @param source The JavaScript code as a string.
 * @returns True if the source is packed, otherwise false.
 */
export function detect(source: string): boolean {
  return source.trim().startsWith("eval(function(p,a,c,k,e,d){");
}

/**
 * Unpacks JavaScript code that has been obfuscated with P.A.C.K.E.R.
 * @param script The packed JavaScript code as a string.
 * @returns The unpacked JavaScript code.
 * @throws Error if unpacking fails due to malformed input.
 */
export function unpack(script: string): string {
  if (!detect(script)) {
    throw new Error("The provided script is not packed with P.A.C.K.E.R.");
  }

  const args = _filterArgs(script);
  const { payload, symtab, radix, count } = args;

  if (count !== symtab.length) {
    throw new Error("Malformed p.a.c.k.e.r. symtab.");
  }

  const unbaser = new Unbaser(radix);
  const regex = /\b\w+\b/g;

  const unpacked = payload.replace(regex, (match) => {
    if (radix === 1) {
      return symtab[parseInt(match)] || match;
    } else {
      const index = unbaser.unbase(match);
      return symtab[index] || match;
    }
  });

  return _replaceStrings(unpacked);
}

/**
 * Extracts the arguments required for unpacking from the packed script.
 * @param source The packed JavaScript code as a string.
 * @returns An object containing payload, symtab, radix, and count.
 * @throws Error if the script does not match the expected pattern.
 */
function _filterArgs(source: string): PackerArgs {
  const juicerRegex =
    /eval\(function\(p,a,c,k,e,d\)\{.*?\}\('(.*)',\s*(\d+|\[\]),\s*(\d+),\s*'(.*)'\.split\('\|'\)/;
  const match = juicerRegex.exec(source);
  if (!match) {
    throw new Error("Could not parse p.a.c.k.e.r. arguments.");
  }

  const payload = match[1];
  const radix = parseInt(match[2], 10);
  const count = parseInt(match[3], 10);
  const symtab = match[4].split("|");

  return { payload, symtab, radix, count };
}

/**
 * Replaces encoded strings within the unpacked script.
 * This function can be customized to handle specific string replacements if necessary.
 * @param source The unpacked JavaScript code as a string.
 * @returns The processed JavaScript code.
 */
function _replaceStrings(source: string): string {
  // Implement string replacement logic if necessary
  return source;
}

/**
 * Unbaser Class
 *
 * Converts numbers from a specified base to decimal.
 */
class Unbaser {
  private dictionary: { [key: string]: number } = {};
  private base: number;

  /**
   * Initializes the Unbaser with a specific base.
   * @param base The numerical base for conversion (e.g., 62).
   */
  constructor(base: number) {
    this.base = base;
    if (base > 36) {
      // Populate dictionary for bases > 36
      const alphabet =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let i = 0; i < alphabet.length && i < base; i++) {
        this.dictionary[alphabet[i]] = i;
      }
      this.unbase = this._dictUnbaser.bind(this);
    } else {
      this.unbase = (value: string) => parseInt(value, base);
    }
  }

  /**
   * Converts a value from the specified base to decimal using the dictionary.
   * @param value The string representation of the number in the original base.
   * @returns The decimal equivalent as a number.
   * @throws Error if the value contains characters not present in the dictionary.
   */
  private _dictUnbaser(value: string): number {
    let ret = 0;
    for (let i = value.length - 1, power = 0; i >= 0; i--, power++) {
      const char = value[i];
      const digit = this.dictionary[char];
      if (digit === undefined) {
        throw new Error(`Unknown character '${char}' in base ${this.base}`);
      }
      ret += digit * Math.pow(this.base, power);
    }
    return ret;
  }

  /**
   * Converts a value from the specified base to decimal.
   * This function is dynamically assigned based on the base during initialization.
   * @param value The string representation of the number in the original base.
   * @returns The decimal equivalent as a number.
   */
  unbase: (value: string) => number;
}
