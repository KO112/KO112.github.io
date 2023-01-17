// Force declaration of variables
"use strict";


var Program = function Program(vertexShader, fragmentShader) {
	this.uniforms = {};
	this.program = createProgram(vertexShader, fragmentShader);
	this.uniforms = getUniforms(this.program);
};


Program.prototype.bind = function bind() {
	gl.useProgram(this.program);
};


function createProgram(vertexShader, fragmentShader) {
	var program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw gl.getProgramInfoLog(program);
	return program;
}


function getUniforms(program) {
	var uniforms = [];
	var uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
	for (var i = 0; i < uniformCount; i++) {
		var uniformName = gl.getActiveUniform(program, i).name;
		uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
	}
	return uniforms;
}


function compileShader(type, source, keywords) {
	source = addKeywords(source, keywords);
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(shader);
	return shader;
}


function addKeywords(source, keywords) {
	if (keywords == null) return source;
	var keywordsString = '';
	keywords.forEach(function(keyword) {
		keywordsString += '#define ' + keyword + '\n';
	});
	return keywordsString + source;
}
