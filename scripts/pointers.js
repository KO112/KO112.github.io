// Force declaration of variables
"use strict";


function pointerPrototype() {
	this.id = -1;
	this.texcoordX = 0;
	this.texcoordY = 0;
	this.prevTexcoordX = 0;
	this.prevTexcoordY = 0;
	this.deltaX = 0;
	this.deltaY = 0;
	this.down = false;
	this.moved = false;
	this.color = [30, 0, 300];
}


function correctDeltaX(delta) {
	var aspectRatio = canvas.width / canvas.height;
	if (aspectRatio < 1) { delta *= aspectRatio; }
	return delta;
}


function correctDeltaY(delta) {
	var aspectRatio = canvas.width / canvas.height;
	if (aspectRatio > 1) { delta /= aspectRatio; }
	return delta;
}


function getResolution(resolution) {
	var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
	if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
	
	var min = Math.round(resolution);
	var max = Math.round(resolution * aspectRatio);
	
	if (gl.drawingBufferWidth > gl.drawingBufferHeight) return {width: max, height: min};
	else return {width: min, height: max};
}


function getTextureScale(texture, width, height) {
	return {
		x: width / texture.width,
		y: height / texture.height
	};
}


function scaleByPixelRatio(input) {
	var pixelRatio = window.devicePixelRatio || 1;
	return Math.floor(input * pixelRatio);
}


// Activate a pointer
function updatePointerDownData(pointer, id, posX, posY) {
	
	// if (canvas.height > canvas.width) {
	// 	var temp = posX;
	// 	posX = posY;
	// 	posY = temp;
	// }
	
	pointer.id = id;
	pointer.down = true;
	pointer.moved = false;
	pointer.texcoordX = scaleByPixelRatio(posX) / canvas.width;
	pointer.texcoordY = 1.0 - scaleByPixelRatio(posY) / canvas.height;
	pointer.prevTexcoordX = pointer.texcoordX;
	pointer.prevTexcoordY = pointer.texcoordY;
	pointer.deltaX = 0;
	pointer.deltaY = 0;
	pointer.color = generateColor();
	
}


// Move a pointer
function updatePointerMoveData(pointer, posX, posY) {
	
	// if (canvas.height > canvas.width) {
	// 	var temp = posX;
	// 	posX = posY;
	// 	posY = temp;
	// }
	
	// console.log("updatePointerMoveData", posX, posY, pointer);
	pointer.prevTexcoordX = pointer.texcoordX;
	pointer.prevTexcoordY = pointer.texcoordY;
	pointer.texcoordX = scaleByPixelRatio(posX) / canvas.width;
	pointer.texcoordY = 1.0 - scaleByPixelRatio(posY) / canvas.height;
	pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
	pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
	pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
	
}


// Deactivate a pointer
function updatePointerUpData(pointer) {
	pointer.down = false;
}
