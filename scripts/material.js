// Force declaration of variables
"use strict";


var Material = function Material(vertexShader, fragmentShaderSource) {
	this.vertexShader = vertexShader;
	this.fragmentShaderSource = fragmentShaderSource;
	this.programs = [];
	this.activeProgram = null;
	this.uniforms = [];
};


Material.prototype.setKeywords = function setKeywords(keywords) {
	var hash = 0;
	for (var i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
	
	var program = this.programs[hash];
	if (program == null) {
		var fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
		program = createProgram(this.vertexShader, fragmentShader);
		this.programs[hash] = program;
	}
	
	if (program == this.activeProgram) return;
	this.uniforms = getUniforms(program);
	this.activeProgram = program;
};


Material.prototype.bind = function bind() {
	gl.useProgram(this.activeProgram);
};
