// Force declaration of variables
"use strict";


function correctRadius(canvas, radius) {
	// var aspectRatio = canvas.width / canvas.height;
	// if (aspectRatio > 1) radius *= aspectRatio;
	return radius;
}


function splat(canvas, x, y, dx, dy, color) {
	gl.viewport(0, 0, velocity.width, velocity.height);
	splatProgram.bind();
	gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
	gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
	gl.uniform2f(splatProgram.uniforms.point, x, y);
	gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
	gl.uniform1f(splatProgram.uniforms.radius, correctRadius(canvas, config.SPLAT_RADIUS / 100.0));
	blit(velocity.write.fbo);
	velocity.swap();
	gl.viewport(0, 0, dye.width, dye.height);
	gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
	gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
	blit(dye.write.fbo);
	dye.swap();
}


function multipleSplats(canvas, amount) {
	for (var i = 0; i < amount; i++) {
		var color = generateColor();
		color.r *= 10.0;
		color.g *= 10.0;
		color.b *= 10.0;
		var x = Math.random();
		var y = Math.random();
		var dx = 1000 * (Math.random() - 0.5);
		var dy = 1000 * (Math.random() - 0.5);
		splat(canvas, x, y, dx, dy, color);
	}
}


function calcDeltaTime() {
	var now = Date.now();
	var dt = (now - lastUpdateTime) / 1000;
	dt = Math.min(dt, 0.016666);
	lastUpdateTime = now;
	return dt;
}


function updateColors(dt) {
	if (!config.COLORFUL) return;
	colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
	if (colorUpdateTimer >= 1) {
		colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
		pointers.forEach((p) => p.color = generateColor());
	}
}


function splatPointer(canvas, pointer) {
	var dx = pointer.deltaX * config.SPLAT_FORCE;
	var dy = pointer.deltaY * config.SPLAT_FORCE;
	splat(canvas, pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
}


function applyBloom(source, destination) {
	
	if (bloomFramebuffers.length < 2) return;
	
	var last = destination;
	
	gl.disable(gl.BLEND);
	bloomPrefilterProgram.bind();
	var knee = config.BLOOM_THRESHOLD * config.BLOOM_SOFT_KNEE + 0.0001;
	var curve0 = config.BLOOM_THRESHOLD - knee;
	var curve1 = knee * 2;
	var curve2 = 0.25 / knee;
	gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
	gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, config.BLOOM_THRESHOLD);
	gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
	gl.viewport(0, 0, last.width, last.height);
	blit(last.fbo);
	
	bloomBlurProgram.bind();
	for (var i = 0; i < bloomFramebuffers.length; i++) {
		var dest = bloomFramebuffers[i];
		gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
		gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
		gl.viewport(0, 0, dest.width, dest.height);
		blit(dest.fbo);
		last = dest;
	}
	
	gl.blendFunc(gl.ONE, gl.ONE);
	gl.enable(gl.BLEND);
	
	for (var i$1 = bloomFramebuffers.length - 2; i$1 >= 0; i$1--) {
		var baseTex = bloomFramebuffers[i$1];
		gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
		gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
		gl.viewport(0, 0, baseTex.width, baseTex.height);
		blit(baseTex.fbo);
		last = baseTex;
	}
	
	gl.disable(gl.BLEND);
	bloomFinalProgram.bind();
	gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
	gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
	gl.uniform1f(bloomFinalProgram.uniforms.intensity, config.BLOOM_INTENSITY);
	gl.viewport(0, 0, destination.width, destination.height);
	blit(destination.fbo);
	
}


function applySunrays(source, mask, destination) {
	
	gl.disable(gl.BLEND);
	sunraysMaskProgram.bind();
	gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
	gl.viewport(0, 0, mask.width, mask.height);
	blit(mask.fbo);
	
	sunraysProgram.bind();
	gl.uniform1f(sunraysProgram.uniforms.weight, config.SUNRAYS_WEIGHT);
	gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
	gl.viewport(0, 0, destination.width, destination.height);
	blit(destination.fbo);
	
}


function blur(target, temp, iterations) {
	blurProgram.bind();
	for (var i = 0; i < iterations; i++) {
		gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
		gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
		blit(temp.fbo);
		gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
		gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
		blit(target.fbo);
	}
}


function applyInputs(canvas) {
	if (splatStack.length > 0) multipleSplats(canvas, splatStack.pop());
	pointers.forEach(function(p) {
		if (p.moved) {
			p.moved = false;
			splatPointer(canvas, p);
		}
	});
}


function step(dt) {
	
	gl.disable(gl.BLEND);
	gl.viewport(0, 0, velocity.width, velocity.height);
	
	curlProgram.bind();
	gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
	blit(curl.fbo);
	
	vorticityProgram.bind();
	gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
	gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
	gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
	gl.uniform1f(vorticityProgram.uniforms.dt, dt);
	blit(velocity.write.fbo);
	velocity.swap();
	
	divergenceProgram.bind();
	gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
	blit(divergence.fbo);
	
	clearProgram.bind();
	gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
	gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
	blit(pressure.write.fbo);
	pressure.swap();
	
	pressureProgram.bind();
	gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
	for (var i = 0; i < config.PRESSURE_ITERATIONS; i++) {
		gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
		blit(pressure.write.fbo);
		pressure.swap();
	}
	
	gradienSubtractProgram.bind();
	gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
	gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
	blit(velocity.write.fbo);
	velocity.swap();
	
	advectionProgram.bind();
	gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
	if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
	var velocityId = velocity.read.attach(0);
	gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
	gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
	gl.uniform1f(advectionProgram.uniforms.dt, dt);
	gl.uniform1f(advectionProgram.uniforms.dissipation, config.VELOCITY_DISSIPATION);
	blit(velocity.write.fbo);
	velocity.swap();
	
	gl.viewport(0, 0, dye.width, dye.height);
	
	if (!ext.supportLinearFiltering) gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
	gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
	gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
	gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
	blit(dye.write.fbo);
	dye.swap();
	
}


function drawColor(fbo, color) {
	colorProgram.bind();
	gl.uniform4f(colorProgram.uniforms.color, color.r, color.g, color.b, 1);
	blit(fbo);
}


function drawCheckerboard(fbo, canvas) {
	checkerboardProgram.bind();
	gl.uniform1f(checkerboardProgram.uniforms.aspectRatio, canvas.width / canvas.height);
	blit(fbo);
}


function drawDisplay(fbo, width, height) {
	displayMaterial.bind();
	if (config.SHADING) gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
	gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
	if (config.BLOOM) {
		gl.uniform1i(displayMaterial.uniforms.uBloom, bloom.attach(1));
		gl.uniform1i(displayMaterial.uniforms.uDithering, ditheringTexture.attach(2));
		var scale = getTextureScale(ditheringTexture, width, height);
		gl.uniform2f(displayMaterial.uniforms.ditherScale, scale.x, scale.y);
	}
	if (config.SUNRAYS) gl.uniform1i(displayMaterial.uniforms.uSunrays, sunrays.attach(3));
	blit(fbo);
}


function render(target) {
	
	if (config.BLOOM) applyBloom(dye.read, bloom);
	if (config.SUNRAYS) {
		applySunrays(dye.read, dye.write, sunrays);
		blur(sunrays, sunraysTemp, 1);
	}
	
	if (target == null || !config.TRANSPARENT) {
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.BLEND);
	} else {
		gl.disable(gl.BLEND);
	}
	
	var width = target == null ? gl.drawingBufferWidth : target.width;
	var height = target == null ? gl.drawingBufferHeight : target.height;
	gl.viewport(0, 0, width, height);
	
	var fbo = target == null ? null : target.fbo;
	if (!config.TRANSPARENT) drawColor(fbo, normalizeColor(config.BACK_COLOR));
	if (target == null && config.TRANSPARENT) drawCheckerboard(fbo);
	drawDisplay(fbo, width, height);
	
}


function resizeCanvas(canvas) {
	var width = scaleByPixelRatio(canvas.clientWidth);
	var height = scaleByPixelRatio(canvas.clientHeight);
	if (canvas.width != width || canvas.height != height) {
		canvas.width = width;
		canvas.height = height;
		return true;
	}
	return false;
}


function update(canvas) {
	var dt = calcDeltaTime();
	// if (resizeCanvas(canvas)) initFramebuffers();
	// updateColors(dt);
	applyInputs(canvas);
	if (!config.PAUSED) step(dt);
	render(null);
	requestAnimationFrame(() => update(canvas));
}
