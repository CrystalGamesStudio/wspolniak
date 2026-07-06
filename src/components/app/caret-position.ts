// SPDX-License-Identifier: AGPL-3.0-or-later

/** Style kopiowane z textarea do mirror-div, by pozycja znaków się zgadzała. */
const COPIED_STYLES = [
	"boxSizing",
	"width",
	"height",
	"overflowX",
	"overflowY",
	"borderTopWidth",
	"borderRightWidth",
	"borderBottomWidth",
	"borderLeftWidth",
	"borderStyle",
	"paddingTop",
	"paddingRight",
	"paddingBottom",
	"paddingLeft",
	"fontStyle",
	"fontVariant",
	"fontWeight",
	"fontStretch",
	"fontSize",
	"fontSizeAdjust",
	"lineHeight",
	"fontFamily",
	"textAlign",
	"textTransform",
	"textIndent",
	"textDecoration",
	"letterSpacing",
	"wordSpacing",
	"tabSize",
] as const;

export interface CaretCoordinates {
	top: number;
	left: number;
	height: number;
}

/**
 * Zwraca pikselowe współrzędne karetki w textarea (technika mirror-div: klonujemy
 * stylowaną kopię pola, wstawiamy marker na pozycji karetki i czytamy jego offset).
 * Pozwala pozycjonować dropdown @mention przy kursorze, nie tylko pod całym polem.
 * Współrzędne są względem lewego-górnego rogu textarea.
 */
export function getCaretCoordinates(
	element: HTMLTextAreaElement,
	caretPosition: number,
): CaretCoordinates {
	const div = document.createElement("div");
	const style = window.getComputedStyle(element);
	for (const prop of COPIED_STYLES) {
		div.style.setProperty(prop, style.getPropertyValue(prop));
	}
	div.style.position = "absolute";
	div.style.visibility = "hidden";
	div.style.whiteSpace = "pre-wrap";
	div.style.wordWrap = "break-word";

	div.textContent = element.value.substring(0, caretPosition);
	const marker = document.createElement("span");
	marker.textContent = element.value.substring(caretPosition) || ".";
	div.appendChild(marker);

	document.body.appendChild(div);
	const fontSize = parseInt(style.fontSize, 10) || 16;
	const lineHeight = parseInt(style.lineHeight, 10) || fontSize * 1.2;
	const coordinates: CaretCoordinates = {
		top: marker.offsetTop + parseInt(style.borderTopWidth, 10),
		left: marker.offsetLeft + parseInt(style.borderLeftWidth, 10),
		height: lineHeight,
	};
	document.body.removeChild(div);
	return coordinates;
}
