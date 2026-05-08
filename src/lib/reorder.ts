// SPDX-License-Identifier: AGPL-3.0-or-later

export function reorder<T>(list: T[], from: number, to: number): T[] {
	const result = list.slice();
	const [item] = result.splice(from, 1);
	result.splice(to, 0, item);
	return result;
}
