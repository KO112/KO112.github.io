// Force declaration of variables
"use strict";


// Set timeout with paramaters
function setTimeoutParams(fn, delay, ...args) {
	return setTimeout(() => fn(...args), delay)
}


// Determine if this is a mobile browser
function isMobile() {
	return /Mobi|Android/i.test(navigator.userAgent);
}


// Hash an object(?)
function hashCode(s) {
	if (s.length == 0) { return 0; }
	var hash = 0;
	for (var i = 0; i < s.length; i++) {
		hash = (hash << 5) - hash + s.charCodeAt(i);
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}


// Clamp a number between 0 and 1
function clamp01(input) {
	return Math.min(Math.max(input, 0), 1);
}


// Wrap a number between a min & a max
function wrap(value, min, max) {
	var range = max - min;
	if (range == 0) return min;
	return (value - min) % range + min;
}


// Bound a number between a min & a max
function bound(value, min, max) {
	return Math.max(min, Math.min(max, value));
}


// Calculate a random number between two bounds
function rand_between(low, high) {
	return low + Math.random() * (high - low);
}


// Calculate a random number between tow bounds, excluding an inner section
function rand_between_exclude(outer, inner) {
	
	var rand = Math.random();
	var lowerRange = inner[0] - outer[0],
		upperRange = outer[1] - inner[1],
		range = lowerRange + upperRange,
		lowerRangeRatio = lowerRange / range,
		upperRangeRatio = upperRange / range;
	
	// console.log(outer, inner, rand, lowerRange, upperRange, range, lowerRangeRatio, upperRangeRatio);
	
	if (rand < lowerRangeRatio) {
		rand /= lowerRangeRatio;
		return (1 - rand) * outer[0] + rand * inner[0];
	} else {
		rand = 1 - (1 - rand) / lowerRangeRatio;
		return (1 - rand) * inner[1] + rand * outer[1];
	}
	
}


// Calculate the Euclidean distance between two points
function euclidean_distance(from, to) {
	return Math.sqrt((from[0] - to[0]) ** 2 + (from[1] - to[1]) ** 2);
}


// Polar to Cartesian coordinates
function polar_to_cartesian(radius, theta) {
	return {x: radius * Math.cos(theta), y: radius * Math.sin(theta)};
}
