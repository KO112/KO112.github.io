// Force declaration of variables
"use strict";


function startGUI() {
	
	var gui = new dat.GUI({width: 300});
	gui.add(config, 'DYE_RESOLUTION', {'high': 1024, 'medium': 512, 'low': 256, 'very low': 128 }).name('quality').onFinishChange(initFramebuffers);
	gui.add(config, 'SIM_RESOLUTION', {'32': 32, '64': 64, '128': 128, '256': 256 }).name('sim resolution').onFinishChange(initFramebuffers);
	gui.add(config, 'DENSITY_DISSIPATION', 0, 4.0).name('density diffusion');
	gui.add(config, 'VELOCITY_DISSIPATION', 0, 4.0).name('velocity diffusion');
	gui.add(config, 'PRESSURE', 0.0, 1.0).name('pressure');
	gui.add(config, 'CURL', 0, 50).name('vorticity').step(1);
	gui.add(config, 'SPLAT_RADIUS', 0.01, 1.0).name('splat radius');
	gui.add(config, 'SHADING').name('shading').onFinishChange(updateKeywords);
	gui.add(config, 'COLORFUL').name('colorful');
	gui.add(config, 'PAUSED').name('paused').listen();
	
	gui.add({
		fun: function() {
			splatStack.push(parseInt(Math.random() * 20) + 5);
		}
	}, 'fun').name('Random splats');
	
	var bloomFolder = gui.addFolder('Bloom');
	bloomFolder.add(config, 'BLOOM').name('enabled').onFinishChange(updateKeywords);
	bloomFolder.add(config, 'BLOOM_INTENSITY', 0.1, 2.0).name('intensity');
	bloomFolder.add(config, 'BLOOM_THRESHOLD', 0.0, 1.0).name('threshold');
	
	var sunraysFolder = gui.addFolder('Sunrays');
	sunraysFolder.add(config, 'SUNRAYS').name('enabled').onFinishChange(updateKeywords);
	sunraysFolder.add(config, 'SUNRAYS_WEIGHT', 0.3, 1.0).name('weight');
	
	var captureFolder = gui.addFolder('Capture');
	captureFolder.addColor(config, 'BACK_COLOR').name('background color');
	captureFolder.add(config, 'TRANSPARENT').name('transparent');
	captureFolder.add({ fun: captureScreenshot }, 'fun').name('take screenshot');
	
	// var github = gui.add({ fun : function() {
	// 	window.open('https://github.com/PavelDoGreat/WebGL-Fluid-Simulation');
	// 	ga('send', 'event', 'link button', 'github');
	// } }, 'fun').name('Github');
	// github.__li.className = 'cr function bigFont';
	// github.__li.style.borderLeft = '3px solid #8C8C8C';
	// var githubIcon = document.createElement('span');
	// github.domElement.parentElement.appendChild(githubIcon);
	// githubIcon.className = 'icon github';
	
	// var twitter = gui.add({ fun : function() {
	// 	ga('send', 'event', 'link button', 'twitter');
	// 	window.open('https://twitter.com/PavelDoGreat');
	// } }, 'fun').name('Twitter');
	// twitter.__li.className = 'cr function bigFont';
	// twitter.__li.style.borderLeft = '3px solid #8C8C8C';
	// var twitterIcon = document.createElement('span');
	// twitter.domElement.parentElement.appendChild(twitterIcon);
	// twitterIcon.className = 'icon twitter';
	
	// var discord = gui.add({ fun : function() {
	// 	ga('send', 'event', 'link button', 'discord');
	// 	window.open('https://discordapp.com/invite/CeqZDDE');
	// } }, 'fun').name('Discord');
	// discord.__li.className = 'cr function bigFont';
	// discord.__li.style.borderLeft = '3px solid #8C8C8C';
	// var discordIcon = document.createElement('span');
	// discord.domElement.parentElement.appendChild(discordIcon);
	// discordIcon.className = 'icon discord';
	
	// var app = gui.add({
	// 	fun : function() {
	// 		ga('send', 'event', 'link button', 'app');
	// 		window.open('http://onelink.to/5b58bn');
	// 	}
	// }, 'fun').name('Check out mobile app');
	
	// app.__li.className = 'cr function appBigFont';
	// app.__li.style.borderLeft = '3px solid #00FF7F';
	// var appIcon = document.createElement('span');
	// app.domElement.parentElement.appendChild(appIcon);
	// appIcon.className = 'icon app';
	
	// if (isMobile()) gui.close();
	gui.close();
	
}


// Promo code
// var promoPopup = document.getElementsByClassName('promo')[0];
// var promoPopupClose = document.getElementsByClassName('promo-close')[0];
// if (isMobile()) {
// 	setTimeout(function() {
// 		promoPopup.style.display = 'table';
// 	}, 20000);
// }

// promoPopupClose.addEventListener('click', function(e) {
// 	promoPopup.style.display = 'none';
// });

// var appleLink = document.getElementById('apple_link');
// appleLink.addEventListener('click', function(e) {
// 	ga('send', 'event', 'link promo', 'app');
// 	window.open('https://apps.apple.com/us/app/fluid-simulation/id1443124993');
// });

// var googleLink = document.getElementById('google_link');
// googleLink.addEventListener('click', function(e) {
// 	ga('send', 'event', 'link promo', 'app');
// 	window.open('https://play.google.com/store/apps/details?id=games.paveldogreat.fluidsimfree');
// });
