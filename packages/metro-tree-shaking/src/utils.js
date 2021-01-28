/**
 * @flow
 */
export function hasOwnProperty(obj: Object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function intersection<T>(setA: Array<T>, setB: Array<T>): Array<T> {
  const _intersection = [];
  for (const elem of setB) {
    if (setA.includes(elem)) {
      _intersection.push(elem);
    }
  }
  return _intersection;
}

export function difference<T>(setA: Array<T>, setB: Array<T>): Array<T> {
  const _difference = new Set(setA);
  for (const elem of setB) {
      _difference.delete(elem);
  }
  return [..._difference];
}
