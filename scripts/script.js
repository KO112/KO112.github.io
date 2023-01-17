// Force declaration of variables
"use strict";


// Find canvas & fix size
// var canvas = document.getElementsByTagName("canvas")[0];
var canvas = document.getElementById("canvas");
resizeCanvas(canvas);
// console.log(canvas.height, canvas.width);
// canvas.style.transform = "rotate(90deg)";
// canvas.style.height = window.innerWidth + "px";
// canvas.style.width = window.innerHeight + "px";
// console.log(canvas.height, canvas.width);

// Set default configuration
var config = {
	SIM_RESOLUTION: 256,
	DYE_RESOLUTION: 1024,
	CAPTURE_RESOLUTION: 512,
	DENSITY_DISSIPATION: 1,
	VELOCITY_DISSIPATION: 0.2,
	PRESSURE: 0.8,
	PRESSURE_ITERATIONS: 20,
	CURL: 30,
	SPLAT_RADIUS: 0.25,
	SPLAT_FORCE: 6000,
	SHADING: true,
	COLORFUL: true,
	COLOR_UPDATE_SPEED: 10,
	PAUSED: false,
	BACK_COLOR: { r: 0, g: 0, b: 0 },
	TRANSPARENT: false,
	BLOOM: false,
	BLOOM_ITERATIONS: 8,
	BLOOM_RESOLUTION: 256,
	BLOOM_INTENSITY: 0.01,
	BLOOM_THRESHOLD: 1.0,
	BLOOM_SOFT_KNEE: 0.7,
	SUNRAYS: true,
	SUNRAYS_RESOLUTION: 196,
	SUNRAYS_WEIGHT: 1.0,
}

// Update some settings
config.DENSITY_DISSIPATION = 1.0;
config.DENSITY_DISSIPATION = 2.0;
config.DENSITY_DISSIPATION = 3.0;
config.DENSITY_DISSIPATION = 4.0;
config.VELOCITY_DISSIPATION = 6.0;
config.CURL = 30;
config.CURL = 100;
config.SPLAT_RADIUS = 0.125;
config.COLOR_UPDATE_SPEED = [1, 2.5, 10][2];


// Update some configuration defaults based on broser support
var ref = getWebGLContext(canvas);
var gl = ref.gl;
var ext = ref.ext;

if (isMobile()) config.DYE_RESOLUTION = 512;
if (!ext.supportLinearFiltering) {
	config.DYE_RESOLUTION = 512;
	config.SHADING = false;
	config.BLOOM = false;
	config.SUNRAYS = false;
}


// Initialize pointers & splats
var pointers = [];
var splatStack = [];
pointers.push(new pointerPrototype());


// Start the user GUI to let the user change the configuration
startGUI();


// Define shaders

var baseVertexShader = compileShader(gl.VERTEX_SHADER, "\n    precision highp float;\n\n    attribute vec2 aPosition;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform vec2 texelSize;\n\n    void main () {\n        vUv = aPosition * 0.5 + 0.5;\n        vL = vUv - vec2(texelSize.x, 0.0);\n        vR = vUv + vec2(texelSize.x, 0.0);\n        vT = vUv + vec2(0.0, texelSize.y);\n        vB = vUv - vec2(0.0, texelSize.y);\n        gl_Position = vec4(aPosition, 0.0, 1.0);\n    }\n");

var blurVertexShader = compileShader(gl.VERTEX_SHADER, "\n    precision highp float;\n\n    attribute vec2 aPosition;\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    uniform vec2 texelSize;\n\n    void main () {\n        vUv = aPosition * 0.5 + 0.5;\n        float offset = 1.33333333;\n        vL = vUv - texelSize * offset;\n        vR = vUv + texelSize * offset;\n        gl_Position = vec4(aPosition, 0.0, 1.0);\n    }\n");

var blurShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    uniform sampler2D uTexture;\n\n    void main () {\n        vec4 sum = texture2D(uTexture, vUv) * 0.29411764;\n        sum += texture2D(uTexture, vL) * 0.35294117;\n        sum += texture2D(uTexture, vR) * 0.35294117;\n        gl_FragColor = sum;\n    }\n");

var copyShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    uniform sampler2D uTexture;\n\n    void main () {\n        gl_FragColor = texture2D(uTexture, vUv);\n    }\n");

var clearShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform float value;\n\n    void main () {\n        gl_FragColor = value * texture2D(uTexture, vUv);\n    }\n");

var colorShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n\n    uniform vec4 color;\n\n    void main () {\n        gl_FragColor = color;\n    }\n");

var checkerboardShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform float aspectRatio;\n\n    #define SCALE 25.0\n\n    void main () {\n        vec2 uv = floor(vUv * SCALE * vec2(aspectRatio, 1.0));\n        float v = mod(uv.x + uv.y, 2.0);\n        v = v * 0.1 + 0.8;\n        gl_FragColor = vec4(vec3(v), 1.0);\n    }\n");

var displayShaderSource = "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n    uniform sampler2D uBloom;\n    uniform sampler2D uSunrays;\n    uniform sampler2D uDithering;\n    uniform vec2 ditherScale;\n    uniform vec2 texelSize;\n\n    vec3 linearToGamma (vec3 color) {\n        color = max(color, vec3(0));\n        return max(1.055 * pow(color, vec3(0.416666667)) - 0.055, vec3(0));\n    }\n\n    void main () {\n        vec3 c = texture2D(uTexture, vUv).rgb;\n\n    #ifdef SHADING\n        vec3 lc = texture2D(uTexture, vL).rgb;\n        vec3 rc = texture2D(uTexture, vR).rgb;\n        vec3 tc = texture2D(uTexture, vT).rgb;\n        vec3 bc = texture2D(uTexture, vB).rgb;\n\n        float dx = length(rc) - length(lc);\n        float dy = length(tc) - length(bc);\n\n        vec3 n = normalize(vec3(dx, dy, length(texelSize)));\n        vec3 l = vec3(0.0, 0.0, 1.0);\n\n        float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);\n        c *= diffuse;\n    #endif\n\n    #ifdef BLOOM\n        vec3 bloom = texture2D(uBloom, vUv).rgb;\n    #endif\n\n    #ifdef SUNRAYS\n        float sunrays = texture2D(uSunrays, vUv).r;\n        c *= sunrays;\n    #ifdef BLOOM\n        bloom *= sunrays;\n    #endif\n    #endif\n\n    #ifdef BLOOM\n        float noise = texture2D(uDithering, vUv * ditherScale).r;\n        noise = noise * 2.0 - 1.0;\n        bloom += noise / 255.0;\n        bloom = linearToGamma(bloom);\n        c += bloom;\n    #endif\n\n        float a = max(c.r, max(c.g, c.b));\n        gl_FragColor = vec4(c, a);\n    }\n";

var bloomPrefilterShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform vec3 curve;\n    uniform float threshold;\n\n    void main () {\n        vec3 c = texture2D(uTexture, vUv).rgb;\n        float br = max(c.r, max(c.g, c.b));\n        float rq = clamp(br - curve.x, 0.0, curve.y);\n        rq = curve.z * rq * rq;\n        c *= max(rq, br - threshold) / max(br, 0.0001);\n        gl_FragColor = vec4(c, 0.0);\n    }\n");

var bloomBlurShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n\n    void main () {\n        vec4 sum = vec4(0.0);\n        sum += texture2D(uTexture, vL);\n        sum += texture2D(uTexture, vR);\n        sum += texture2D(uTexture, vT);\n        sum += texture2D(uTexture, vB);\n        sum *= 0.25;\n        gl_FragColor = sum;\n    }\n");

var bloomFinalShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uTexture;\n    uniform float intensity;\n\n    void main () {\n        vec4 sum = vec4(0.0);\n        sum += texture2D(uTexture, vL);\n        sum += texture2D(uTexture, vR);\n        sum += texture2D(uTexture, vT);\n        sum += texture2D(uTexture, vB);\n        sum *= 0.25;\n        gl_FragColor = sum * intensity;\n    }\n");

var sunraysMaskShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n\n    void main () {\n        vec4 c = texture2D(uTexture, vUv);\n        float br = max(c.r, max(c.g, c.b));\n        c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);\n        gl_FragColor = c;\n    }\n");

var sunraysShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uTexture;\n    uniform float weight;\n\n    #define ITERATIONS 16\n\n    void main () {\n        float Density = 0.3;\n        float Decay = 0.95;\n        float Exposure = 0.7;\n\n        vec2 coord = vUv;\n        vec2 dir = vUv - 0.5;\n\n        dir *= 1.0 / float(ITERATIONS) * Density;\n        float illuminationDecay = 1.0;\n\n        float color = texture2D(uTexture, vUv).a;\n\n        for (int i = 0; i < ITERATIONS; i++)\n        {\n            coord -= dir;\n            float col = texture2D(uTexture, coord).a;\n            color += col * illuminationDecay * weight;\n            illuminationDecay *= Decay;\n        }\n\n        gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);\n    }\n");

var splatShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uTarget;\n    uniform float aspectRatio;\n    uniform vec3 color;\n    uniform vec2 point;\n    uniform float radius;\n\n    void main () {\n        vec2 p = vUv - point.xy;\n        p.x *= aspectRatio;\n        vec3 splat = exp(-dot(p, p) / radius) * color;\n        vec3 base = texture2D(uTarget, vUv).xyz;\n        gl_FragColor = vec4(base + splat, 1.0);\n    }\n");

var advectionShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    uniform sampler2D uVelocity;\n    uniform sampler2D uSource;\n    uniform vec2 texelSize;\n    uniform vec2 dyeTexelSize;\n    uniform float dt;\n    uniform float dissipation;\n\n    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {\n        vec2 st = uv / tsize - 0.5;\n\n        vec2 iuv = floor(st);\n        vec2 fuv = fract(st);\n\n        vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);\n        vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);\n        vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);\n        vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);\n\n        return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);\n    }\n\n    void main () {\n    #ifdef MANUAL_FILTERING\n        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;\n        vec4 result = bilerp(uSource, coord, dyeTexelSize);\n    #else\n        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;\n        vec4 result = texture2D(uSource, coord);\n    #endif\n        float decay = 1.0 + dissipation * dt;\n        gl_FragColor = result / decay;\n    }",
	ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']
);

var divergenceShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uVelocity;\n\n    void main () {\n        float L = texture2D(uVelocity, vL).x;\n        float R = texture2D(uVelocity, vR).x;\n        float T = texture2D(uVelocity, vT).y;\n        float B = texture2D(uVelocity, vB).y;\n\n        vec2 C = texture2D(uVelocity, vUv).xy;\n        if (vL.x < 0.0) { L = -C.x; }\n        if (vR.x > 1.0) { R = -C.x; }\n        if (vT.y > 1.0) { T = -C.y; }\n        if (vB.y < 0.0) { B = -C.y; }\n\n        float div = 0.5 * (R - L + T - B);\n        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);\n    }\n");

var curlShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uVelocity;\n\n    void main () {\n        float L = texture2D(uVelocity, vL).y;\n        float R = texture2D(uVelocity, vR).y;\n        float T = texture2D(uVelocity, vT).x;\n        float B = texture2D(uVelocity, vB).x;\n        float vorticity = R - L - T + B;\n        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);\n    }\n");

var vorticityShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision highp float;\n    precision highp sampler2D;\n\n    varying vec2 vUv;\n    varying vec2 vL;\n    varying vec2 vR;\n    varying vec2 vT;\n    varying vec2 vB;\n    uniform sampler2D uVelocity;\n    uniform sampler2D uCurl;\n    uniform float curl;\n    uniform float dt;\n\n    void main () {\n        float L = texture2D(uCurl, vL).x;\n        float R = texture2D(uCurl, vR).x;\n        float T = texture2D(uCurl, vT).x;\n        float B = texture2D(uCurl, vB).x;\n        float C = texture2D(uCurl, vUv).x;\n\n        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));\n        force /= length(force) + 0.0001;\n        force *= curl * C;\n        force.y *= -1.0;\n\n        vec2 vel = texture2D(uVelocity, vUv).xy;\n        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);\n    }\n");

var pressureShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uPressure;\n    uniform sampler2D uDivergence;\n\n    void main () {\n        float L = texture2D(uPressure, vL).x;\n        float R = texture2D(uPressure, vR).x;\n        float T = texture2D(uPressure, vT).x;\n        float B = texture2D(uPressure, vB).x;\n        float C = texture2D(uPressure, vUv).x;\n        float divergence = texture2D(uDivergence, vUv).x;\n        float pressure = (L + R + B + T - divergence) * 0.25;\n        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);\n    }\n");

var gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, "\n    precision mediump float;\n    precision mediump sampler2D;\n\n    varying highp vec2 vUv;\n    varying highp vec2 vL;\n    varying highp vec2 vR;\n    varying highp vec2 vT;\n    varying highp vec2 vB;\n    uniform sampler2D uPressure;\n    uniform sampler2D uVelocity;\n\n    void main () {\n        float L = texture2D(uPressure, vL).x;\n        float R = texture2D(uPressure, vR).x;\n        float T = texture2D(uPressure, vT).x;\n        float B = texture2D(uPressure, vB).x;\n        vec2 velocity = texture2D(uVelocity, vUv).xy;\n        velocity.xy -= vec2(R - L, T - B);\n        gl_FragColor = vec4(velocity, 0.0, 1.0);\n    }\n");


var blit = (function() {
	
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(0);
	
	return function(destination) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	}
	
})();


var dye;
var velocity;
var divergence;
var curl;
var pressure;
var bloom;
var bloomFramebuffers = [];
var sunrays;
var sunraysTemp;

var ditheringTexture = createTextureAsync('LDR_LLL1_0.png');

var blurProgram            = new Program(blurVertexShader, blurShader);
var copyProgram            = new Program(baseVertexShader, copyShader);
var clearProgram           = new Program(baseVertexShader, clearShader);
var colorProgram           = new Program(baseVertexShader, colorShader);
var checkerboardProgram    = new Program(baseVertexShader, checkerboardShader);
var bloomPrefilterProgram  = new Program(baseVertexShader, bloomPrefilterShader);
var bloomBlurProgram       = new Program(baseVertexShader, bloomBlurShader);
var bloomFinalProgram      = new Program(baseVertexShader, bloomFinalShader);
var sunraysMaskProgram     = new Program(baseVertexShader, sunraysMaskShader);
var sunraysProgram         = new Program(baseVertexShader, sunraysShader);
var splatProgram           = new Program(baseVertexShader, splatShader);
var advectionProgram       = new Program(baseVertexShader, advectionShader);
var divergenceProgram      = new Program(baseVertexShader, divergenceShader);
var curlProgram            = new Program(baseVertexShader, curlShader);
var vorticityProgram       = new Program(baseVertexShader, vorticityShader);
var pressureProgram        = new Program(baseVertexShader, pressureShader);
var gradienSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);

var displayMaterial = new Material(baseVertexShader, displayShaderSource);


// 
updateKeywords();
initFramebuffers();
// multipleSplats(parseInt(Math.random() * 20) + 5);
var lastUpdateTime = Date.now();
var colorUpdateTimer = 0.0;
update(canvas);




// Listeners


// Mouse listeners

canvas.addEventListener('mousedown', function(e) {
	var pointer = pointers.find((p)  => p.id == -1);
	if (pointer == null) pointer = new pointerPrototype();
	updatePointerDownData(pointer, -1, e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', function(e) {
	var pointer = pointers[0];
	if (!pointer.down) return;
	updatePointerMoveData(pointer, e.offsetX, e.offsetY);
});

window.addEventListener('mouseup', function() {
	updatePointerUpData(pointers[0]);
});


// Touch listeners

canvas.addEventListener('touchstart', function(e) {
	e.preventDefault();
	var touches = e.targetTouches;
	while (touches.length >= pointers.length) pointers.push(new pointerPrototype());
	for (var i = 0; i < touches.length; i++) {
		updatePointerDownData(pointers[i + 1], touches[i].identifier, touches[i].pageX, touches[i].pageY);
	}
});

canvas.addEventListener('touchmove', function(e) {
	e.preventDefault();
	var touches = e.targetTouches;
	for (var i = 0; i < touches.length; i++) {
		var pointer = pointers[i + 1];
		if (!pointer.down) continue;
		updatePointerMoveData(pointer, touches[i].pageX, touches[i].pageY);
	}
}, false);

window.addEventListener('touchend', function(e) {
	var touches = e.changedTouches;
	var loop = function(i) {
		var pointer = pointers.find(function(p) { return p.id == touches[i].identifier; });
		if (pointer == null) { return; }
		updatePointerUpData(pointer);
	};
	
	for (var i = 0; i < touches.length; i++)
	loop( i );
});


// Keyboard listeners

window.addEventListener('keydown', function(e) {
	if (e.code === 'KeyP') config.PAUSED = !config.PAUSED;
	if (e.key === ' ') splatStack.push(parseInt(Math.random() * 20) + 5);
});




// Simulations


// Simulate mouse drag
function simulate_drag(pointer, x, y) {
	return () => {
		if (!pointer.down) return;
		var posX = x;
		var posY = y;
		updatePointerMoveData(pointer, posX, posY);
	}
}


// Calculate a drag between two points
function calculate_drag(pointer, startX, startY, endX, endY) {
	
	// 
	updatePointerDownData(pointer, pointer.id, 0, 0);
	var distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
	if (distance < canvas.width / 2) return 0;
	var dragTime = Math.max(250, distance / 4), numIter = rand_between(125, 375);
	
	// 
	for (var i = 0; i < numIter; ++i) {
		var x = (startX * (1 - i / numIter) + endX * (i / numIter)) + (Math.random() - 1) * 5;
		var y = (startY * (1 - i / numIter) + endY * (i / numIter)) + (Math.random() - 1) * 5;
		setTimeoutParams(simulate_drag(pointer, x, y), i * dragTime / numIter);
	}
	
	// 
	setTimeoutParams(() => updatePointerUpData(pointer), dragTime);
	return dragTime;
	
}


// Make a dragger
function make_drag() {
	var startX = canvas.width * rand_between(0.1, 0.9),
		startY = canvas.height * rand_between(0.1, 0.9),
		endX = canvas.width * rand_between(0.1, 0.9),
		endY = canvas.height * rand_between(0.1, 0.9);
	var dragTime = calculate_drag(pointers[0], startX, startY, endX, endY);
	setTimeoutParams(make_drag, (dragTime == 0) ? 0 : dragTime + 500 + Math.random() * 500);
}
// make_drag();


// Drag in a line
function drag_line(pointer, from, to, numIter, delay) {
	// console.log("drag_line", from, to, numIter, delay, pointer)
	for (var i = 0; i < numIter; ++i) {
		var newX = from.x + (to.x - from.x) * i / numIter;
		var newY = from.y + (to.y - from.y) * i / numIter;
		setTimeoutParams(updatePointerMoveData, i * delay, pointer, newX, newY);
	}
	return i * delay
}


// Initialize pointers
var pointer = new pointerPrototype();
var pointer1 = new pointerPrototype();
var pointer2 = new pointerPrototype();
var pointer3 = new pointerPrototype();
var pointer4 = new pointerPrototype();
var pointer5 = new pointerPrototype();
var pointer6 = new pointerPrototype();
updatePointerDownData(pointer, 0, 0, 0);
updatePointerDownData(pointer1, 1, 0, 0);
updatePointerDownData(pointer2, 2, 0, 0);
updatePointerDownData(pointer3, 3, 0, 0);
updatePointerDownData(pointer4, 4, 0, 0);
updatePointerDownData(pointer5, 5, 0, 0);
updatePointerDownData(pointer6, 6, 0, 0);
pointers.push(pointer, pointer1, pointer2, pointer3, pointer4, pointer5, pointer6);


// Simulate movement
var counter = 0;
var time = 750, numIterX = 750, numIterY = 8;
var delay = time / numIterX;


function connect_points(pointer, delay, points, startTime) {
	// pointer.color = {r: 0, g: 0.15, b: 0};
	var time  = 0;
	for (var j = 0; j < points.length - 1; ++j) {
		var start = points[j], end = points[j + 1], distance = euclidean_distance(start, end) / 3;
		setTimeoutParams(drag_line, startTime + time, pointer, {x: start[0], y: start[1]}, {x: end[0], y: end[1]}, distance, delay);
		time += distance * delay;
	}
	return time;
}

// Run the simulation multiple times
var time = 0, timeFour = 0, timeTwo = 0, timeZero = 0;
var x = canvas.width / 2, y = canvas.height / 2;
for (var i = 0; i < 100; ++i) {
	
	// Manual method
	// for (var y = Math.round(0.1 * numIterY); y < Math.round(0.9 * numIterY); ++y) {
	// 	for (var x = Math.round(0.1 * numIterX); x < Math.round(0.9 * numIterX); ++x) {
	// 		var newX = canvas.width * x / numIterX;
	// 		var newY = canvas.height * (y + x / numIterX) / numIterY;
	// 		if (y % 2 == 0) newX = canvas.width - newX;
	// 		setTimeoutParams(updatePointerMoveData, counter * delay, pointer, newX, newY);
	// 		++counter;
	// 	}
	// }
	
	// Line drawing method
	// for (var y = 1; y < numIterY - 1; ++y) {
	// 	var xVals = (y % 2 == 1) ? [0.1, 0.9] : [0.9, 0.1];
	// 	setTimeoutParams(drag_line, time * (y - 1 + i * (numIterY - 2)), pointer, {x: canvas.width * xVals[0], y: canvas.height * y / numIterY}, {x: canvas.width * xVals[1], y: canvas.height * (y + 1) / numIterY}, numIterX, delay);
	// }
	
	// Corners
	// var gap = 100, delay = 2 / 3; // , numIter = 500;
	// var points = [[gap, gap], [canvas.width - gap, gap], [canvas.width - gap, canvas.height - gap], [gap, canvas.height - gap], [gap, gap]];
	// // var points = [[0.1, 0.1], [0.1, 0.9], [0.9, 0.9], [0.9, 0.1], [0.1, 0.1]].map(x => [canvas.width * x[0], canvas.height * x[1]]);
	// for (var j = 0; j < points.length - 1; ++j) {
	// 	var start = points[j], end = points[j + 1];
	// 	var distance = euclidean_distance(start, end) / 3;
	// 	setTimeoutParams(drag_line, time, pointer, {x: start[0], y: start[1]}, {x: end[0], y: end[1]}, distance, delay);
	// 	time += distance * delay;
	// }
	
	// Numbers
	// var delay = 1;
	// var pointsFour = [[canvas.width / 4, canvas.height], [canvas.width / 4, 50], [50, canvas.height / 2], [canvas.width / 4, canvas.height / 2]];
	// var pointsTwo = [[canvas.width / 2 - 350, 50], [canvas.width / 2 + 250, 50], [canvas.width / 2 + 250, canvas.height / 2], [canvas.width / 2 - 250, canvas.height / 2], [canvas.width / 2 - 250, canvas.height - 50], [canvas.width / 2 + 250, canvas.height - 50]];
	// var pointsZero = [[canvas.width * 3 / 4, 50], [canvas.width - 50, 50], [canvas.width - 50, canvas.height / 2], [canvas.width - 50, canvas.height - 50], [canvas.width * 3 / 4, canvas.height - 50], [canvas.width * 3 / 4, canvas.height / 2], [canvas.width * 3 / 4, 50]];
	// timeFour += connect_points(pointer1, delay, pointsFour, timeFour);
	// timeTwo += connect_points(pointer2, delay, pointsTwo, timeTwo);
	// timeZero += connect_points(pointer3, delay, pointsZero, timeZero);
	
	// Sin waves
	// var points = [];
	// for (var y = 0; y < canvas.height; y += 0.5) {
	// 	var x = canvas.width * [0.5 - 0.4 * Math.cos(Math.PI * 4 * y / canvas.height)];
	// 	setTimeoutParams(updatePointerMoveData, counter * 1, pointer, x, y);
	// 	++counter;
	// }
	
	// 2D random walk
	// var stepSize = 250,
	// 	outer = [-stepSize, stepSize],
	// 	inner = [-stepSize / 2, stepSize / 2],
	// 	newX = bound(x + rand_between_exclude(outer, inner), 75, canvas.width - 75),
	// 	newY = bound(y + rand_between_exclude(outer, inner), 75, canvas.height - 75);
	// time += connect_points(pointer1, 2.5, [[x, y], [newX, newY]], time);
	// x = newX, y = newY;
	
}


// Draw a single circle point given the polar coordinates
var oldColor = {r: 0.15, g: 0.0, b: 0.0}, newColor = {r: 0.0, g: 0.15, b: 0.0};
function draw_circle_point(pointer, radius, angle, updateAngle = 240) {
	
	// Generate a new color to change to
	// if (angle == updateAngle) {
	// 	// pointer.color = generateColor();
	// 	oldColor = newColor;
	// 	newColor = generateColor();
	// }
	// pointer.color = interpolate_color(oldColor, newColor, angle / 360);
	
	// Update the color slightly every so often
	if (angle % 1 == 0) {
		pointer.color = HSVtoRGB(angle / 360, 1.0, 1.0);
		pointer.color.r *= 0.15; pointer.color.g *= 0.15; pointer.color.b *= 0.15;
	}
	
	// Convert from polar coordinates to x/y & move the pointer
	var theta = angle * Math.PI / 180;
	var coords = polar_to_cartesian(radius, theta);
	updatePointerMoveData(pointer, canvas.width / 2 + coords.x, canvas.height / 2 + coords.y);
	
}

// Circles/ellipses (radians)
function draw_circle(pointer, radius = 500, startAngle = 0, updateAngle = 240, step = 1, delay = 5) {
	var time = 0;
	for (var angle = startAngle; angle < startAngle + 360; angle += step) {
		setTimeoutParams(draw_circle_point, time, pointer, radius, angle, updateAngle);
		time += delay;
	}
	return time;
}

// Repeatedly draw circles
function loop_circle(pointer, radius = 500, startAngle = 0, updateAngle = 240, step = 1, delay = 5) {
	var time = draw_circle(pointer, radius, startAngle, updateAngle, step, delay);
	setTimeoutParams(loop_circle, time, pointer, radius, startAngle, updateAngle, step, delay);
}


// Draw a single figure eight point given the polar coordinates
function draw_figure_eight_point(pointer, xRadius, yRadius, xCenter, yCenter, angle, updateAngle) {
	
	var theta = angle * Math.PI / 180;
	var x = xCenter + xRadius * Math.cos(theta) * Math.sin(theta) / (1 + Math.sin(theta) ** 2);
	var y = yCenter + yRadius * Math.cos(theta) / (1 + Math.sin(theta) ** 2);
	
	if (canvas.height > canvas.width) {
		var temp = x;
		x = y * (canvas.width / canvas.height), y = temp * (canvas.height / canvas.width);
	}
	
	// console.log(angle, theta, x, y);
	updatePointerMoveData(pointer, x, y);
}

// Draw a figure eight
function draw_figure_eight(pointer, xRadius, yRadius, xCenter = canvas.width / 2, yCenter = canvas.height / 2, startAngle = -90, updateAngle = 240, step = 0.5, delay = 5) {
	// delay /= 2;
	var delayTime = 0;
	for (var angle = startAngle; angle < startAngle + 360; angle += step) {
		setTimeoutParams(draw_figure_eight_point, (angle - startAngle) * delay, pointer, xRadius, yRadius, xCenter, yCenter, angle, updateAngle);
		// if (Math.abs(angle % 180) <= 15) angle -= step * 0.5;
		// setTimeoutParams(draw_figure_eight_point, delayTime, pointer, xRadius, yRadius, xCenter, yCenter, angle, updateAngle);
		// delayTime += delay; // (Math.abs(180 - angle) <= 45) ? delay * 2 : delay;
	}
	return 360 * delay;
	return delayTime;
}

// Repeatedly draw figure eights
function loop_figure_eight(pointer, xRadius, yRadius, xCenter = canvas.width / 2, yCenter = canvas.height / 2, startAngle = -90, updateAngle = 240, step = 0.5, delay = 5) {
	var time = draw_figure_eight(pointer, xRadius, yRadius, xCenter, yCenter, startAngle, updateAngle, step, delay);
	setTimeoutParams(loop_figure_eight, time, pointer, xRadius, yRadius, xCenter, yCenter, startAngle, updateAngle, step, delay);
}


// // Draw a single figure eight point given the polar coordinates
// function draw_figure_eight_point2(pointer, xRadius, yRadius, angle, updateAngle = 240) {
// 	var theta = angle * Math.PI / 180;
// 	// var x = canvas.width / 2 + xRadius * Math.cos(theta) * Math.sin(theta);
// 	// var y = canvas.height / 2 + yRadius * Math.cos(theta);
// 	var x = canvas.width / 2 + yRadius * Math.cos(theta) / (1 + Math.sin(theta) ** 2);
// 	var y = canvas.height / 2 + xRadius * Math.cos(theta) * Math.sin(theta) / (1 + Math.sin(theta) ** 2);
// 	// console.log(angle, theta, x, y);
// 	updatePointerMoveData(pointer, x, y);
// }

// // Draw a figure eight
// function draw_figure_eight2(pointer, xRadius, yRadius, startAngle = -90, updateAngle = 240, step = 0.5, delay = 5) {
// 	for (var angle = startAngle; angle < startAngle + 360; angle += step) {
// 		setTimeoutParams(draw_figure_eight_point2, (angle - startAngle) * delay, pointer, xRadius, yRadius, angle, updateAngle)
// 	}
// 	return 360 * delay;
// }

// // Repeatedly draw figure eights
// function loop_figure_eight2(pointer, xRadius, yRadius, startAngle = -90, updateAngle = 240, step = 0.5, delay = 5) {
// 	var time = draw_figure_eight2(pointer, xRadius, yRadius, startAngle, updateAngle, step, delay);
// 	setTimeoutParams(loop_figure_eight2, time, pointer, xRadius, yRadius, startAngle, updateAngle, step, delay);
// }

// // Draw a figure eight (lemniscate)
// pointer6.color = {r: 0.15, g: 0.05, b: 0};
// loop_figure_eight2(pointer6, canvas.height, canvas.width * 0.45, 225, 240, 0.25, 7.5);


// Draw a single spiral point
function draw_spiral_point() {
	
}

// Draw a spiral
function draw_spiral() {
	
}

// Repeatedly draw spirals
function loop_spiral() {
	
}


// Draw digits
// ...


// 
function draw_random_point(pointer) {
	
}


// 
function draw_random_path(pointer) {
	
}




// Draw figure eights (lemniscates)
pointer4.color = {r: 0.15, g: 0.05, b: 0};
pointer5.color = {r: 0, g: 0.15, b: 0};
// pointer5.color = {r: 0.05, g: 0, b: 0.15};


// Change output based on screen shape
if (canvas.height < canvas.width) {
	
	// Draw circles & figure eights
	draw_random_path(pointer1);
	loop_circle(pointer1, 0.45 * Math.min(canvas.height, canvas.width));
	loop_circle(pointer2, 425, 240);
	loop_circle(pointer3, 250, 120);
	loop_figure_eight(pointer4, 750, canvas.height * 0.45, canvas.width / 7, canvas.height / 2, 90);
	loop_figure_eight(pointer5, 750, canvas.height * 0.45, canvas.width * 6 / 7, canvas.height / 2, -90);
	
} else {
	
	// Update some settings
	config.DENSITY_DISSIPATION = 0.25 + 3 * Math.random();
	config.VELOCITY_DISSIPATION = 0.25 + 3 * Math.random();
	config.CURL = 50 *  Math.random();
	config.SPLAT_RADIUS = 0.075;
	
	// Draw circles & figure eights
	loop_circle(pointer1, 0.35 * Math.min(canvas.height, canvas.width));
	loop_circle(pointer2, 275, 240);
	loop_circle(pointer3, 150, 120);
	loop_figure_eight(pointer4, 375, canvas.height * 0.45, canvas.width / 7, canvas.height / 2, 90);
	loop_figure_eight(pointer5, 375, canvas.height * 0.45, canvas.width * 6 / 7, canvas.height / 2, -90);
	
}
