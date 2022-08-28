import * as mime from 'mime-types';
import { v4 as uuid } from 'uuid';
import { ensureArray } from '../util/Util';
import { GREL, IDLAB } from '../util/Vocabularies';

function toBoolean(val: string | boolean): boolean {
  if (
    (typeof val === 'string' && val === 'true') ||
    (typeof val === 'boolean' && val)
  ) {
    return true;
  }
  return false;
}

export const functions = {
  [GREL.arrayJoin]([ separator, ...parts ]: string[]): string {
    return parts.join(separator);
  },
  [GREL.controlsIf](data: Record<string | number, any>): boolean {
    if (
      (typeof data[GREL.boolB] === 'string' && data[GREL.boolB] === 'true') ||
      (typeof data[GREL.boolB] === 'boolean' && data[GREL.boolB])
    ) {
      return data[GREL.anyTrue];
    }
    return data[GREL.anyFalse] || null;
  },
  [GREL.stringEndsWith](data: any): boolean {
    const string = data[GREL.valueParameter];
    const suffix = data[GREL.stringSub];
    return typeof string === 'string' && string.endsWith(suffix);
  },
  [GREL.stringReplace](data: any): boolean {
    const string = data[GREL.valueParameter];
    const replace = data[GREL.pStringFind];
    const value = data[GREL.pStringReplace];
    return string.replace(replace, value);
  },
  [GREL.dateNow](): string {
    return new Date().toISOString();
  },
  [GREL.dateInc](data: any): string {
    const fromDate = new Date(data[GREL.pDateD]);
    const toDate = new Date(fromDate.getTime());
    const change = Number.parseInt(data[GREL.pDecN], 10);
    if (data[GREL.pStringUnit] === 'year') {
      toDate.setFullYear(fromDate.getFullYear() + change);
    } else if (data[GREL.pStringUnit] === 'month') {
      toDate.setMonth(fromDate.getMonth() + change);
    } else if (data[GREL.pStringUnit] === 'day') {
      toDate.setDate(fromDate.getDate() + change);
    } else if (data[GREL.pStringUnit] === 'hour') {
      toDate.setHours(fromDate.getHours() + change);
    } else if (data[GREL.pStringUnit] === 'minute') {
      toDate.setMinutes(fromDate.getMinutes() + change);
    } else if (data[GREL.pStringUnit] === 'second') {
      toDate.setSeconds(fromDate.getSeconds() + change);
    }
    return toDate.toISOString();
  },
  [GREL.arraySum](data: any): number {
    const values = data[GREL.pArrayA];
    if (Array.isArray(values)) {
      return values.reduce((sum: number, num: string): number => sum + Number.parseFloat(num), 0);
    }
    return Number.parseFloat(values);
  },
  // Note: this is not in the GREL spec
  // it follows the same params syntax as array sum
  [GREL.arrayProduct](data: any): number {
    const values = data[GREL.pArrayA];
    if (Array.isArray(values)) {
      return values.reduce((sum: number, num: string): number => sum * Number.parseFloat(num), 1);
    }
    return Number.parseFloat(values);
  },
  [GREL.booleanNot](data: any): boolean {
    return !toBoolean(data[GREL.boolB]);
  },
  [GREL.booleanAnd](values: (string | boolean)[]): boolean {
    return values.every((val: string | boolean): boolean => toBoolean(val));
  },
  [GREL.booleanOr](values: (string | boolean)[]): boolean {
    return values.some((val: string | boolean): boolean => toBoolean(val));
  },
  [GREL.arrayGet](data: any): any | any[] {
    const from = Number.parseInt(data[GREL.paramIntIFrom], 10);
    if (!data[GREL.paramIntIOptTo]) {
      return data[GREL.pArrayA][from];
    }
    const to = Number.parseInt(data[GREL.paramIntIOptTo], 10);
    return data[GREL.pArrayA].slice(from, to);
  },
  [GREL.stringSplit](data: any): string[] {
    return data[GREL.valueParameter].split(data[GREL.pStringSep]);
  },
  [GREL.max](data: any): number {
    return Math.max(Number.parseInt(data[GREL.pDecN], 10), Number.parseInt(data[GREL.paramN2], 10));
  },
  [GREL.min](data: any): number {
    return Math.min(Number.parseInt(data[GREL.pDecN], 10), Number.parseInt(data[GREL.paramN2], 10));
  },
  [IDLAB.equal]([ argA, argB ]: string[]): boolean {
    return argA === argB;
  },
  [IDLAB.notEqual]([ argA, argB ]: string[]): boolean {
    return argA !== argB;
  },
  [IDLAB.getMimeType](data: any): any {
    return mime.lookup(data[IDLAB.str]);
  },
  [IDLAB.isNull](data: any): boolean {
    const value = data[IDLAB.str];
    return Array.isArray(value) ? value.length === 0 : !value;
  },
  [IDLAB.random](): string {
    return uuid();
  },
  [IDLAB.concat](data: any): string {
    return [
      data[IDLAB.str] as string,
      data[IDLAB.otherStr] as string,
    ].join(data[IDLAB.delimiter] ?? '');
  },
};
