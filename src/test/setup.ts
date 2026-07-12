// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Globalny setup testów Vitest (jsdom).
 *
 * jsdom nie implementuje scrollowania (nie ma layoutu), więc `Element.prototype.scrollIntoView`
 * w ogóle nie istnieje. Komponenty, które utrzymują aktywny element w widoku (np. aktywny wiersz
 * dropdownu @mentions), wołają tę metodę — stubujemy ją tutaj jako no-op, żeby testy komponentów
 * nie rzucały `TypeError`. Pojedynczy test może nadpisać ją własnym spy na konkretnej instancji.
 */
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
	Element.prototype.scrollIntoView = function scrollIntoView() {};
}
