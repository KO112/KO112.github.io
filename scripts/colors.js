// Force declaration of variables
"use strict";


// Generate a random color
function generateColor() {
	return adjust_colors(HSVtoRGB(Math.random(), 1.0, 1.0));
}


// Convert HSV to RGB
function HSVtoRGB(h, s, v) {
	
	var r, g, b, i, f, p, q, t;
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	
	return {r: r, g: g, b: b};
	
}


// Normalize colors between 0 and 1
function normalizeColor(colors) {
	return {r: colors.r / 255, g: colors.g / 255, b: colors.b / 255};
}


// Adjust colors down to a certain level
function adjust_colors(colors, level = 0.15) {
	return {r: colors.r * level, g: colors.g * level, b: colors.b * level}
}


// Interpolate between 2 numbers
function interpolate(from, to, pos) {
	return from * (1 - pos) + to * pos;
}


// Interpolate a color object
function interpolate_color(from, to, pos) {
	return {r: interpolate(from.r, to.r, pos), g: interpolate(from.g, to.g, pos), b: interpolate(from.b, to.b, pos)}
}
