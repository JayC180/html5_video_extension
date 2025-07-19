const minRate = 0.1;
const maxRate = 16.0;
const rateStep = 0.1;
const defaultRate = 1.0;

let lastSpeed = defaultRate;
let lastVolume = 100;
let lastVolumePercent = 100;

// shadow DOM
function hackAttachShadow() {
	if (window._hasHackAttachShadow_) return;
	try {
		const raw = Element.prototype.attachShadow;
		Element.prototype.attachShadow = function(init) {
			if (init && init.mode) {
				init.mode = "open"; // force open
			}
			const shadowRoot = raw.call(this, init);
			console.log("[ShadowHack] Forced open shadow root on:", this);
			return shadowRoot;
		};
		window._hasHackAttachShadow_ = true;
	} catch (e) {
		console.warn("[ShadowHack] Failed to hook attachShadow", e);
	}
}

// weak set for managing mem
function ready(selector, callback) {
	const alreadyHandled = new WeakSet();

	function checkAndRun(root = document) {
		root.querySelectorAll(selector).forEach(el => {
			if (!alreadyHandled.has(el)) {
				alreadyHandled.add(el);
				callback(el);
			}
		});

		// shadow roots
		root.querySelectorAll('*').forEach(el => {
			if (el.shadowRoot) {
				checkAndRun(el.shadowRoot);
			}
		});
	}

	checkAndRun();

	// ob new elem
	const observer = new MutationObserver(() => checkAndRun());
	observer.observe(document.documentElement || document.body, {
		childList: true,
		subtree: true
	});
}

function enhanceVideo(video) {
	if (!video || video._enhancedByExtension) return;
	video._enhancedByExtension = true;

	// default vol 100
	const savedVol = parseFloat(sessionStorage.getItem("volumeBoost")) || 100;
	applyBoostedVolume(savedVol);

	const savedSpeed = parseFloat(sessionStorage.getItem('playbackRate'));
	if (savedSpeed && savedSpeed !== video.playbackRate) {
		video.playbackRate = savedSpeed;
	}
}

function showSpeedOverlay(speed) {
	let overlay = document.getElementById('video-speed-overlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'video-speed-overlay';
		Object.assign(overlay.style, {
			position: 'fixed',
			top: '10px',
			left: '10px',
			zIndex: 99999,
			padding: '4px 8px',
			backgroundColor: 'rgba(0,0,0,0.7)',
			color: '#fff',
			fontSize: '14px',
			fontFamily: 'monospace',
			borderRadius: '4px',
			pointerEvents: 'none',
		});
		document.body.appendChild(overlay);
	}

	overlay.textContent = `${speed.toFixed(2)}x`;
	overlay.style.display = 'block';

	clearTimeout(overlay._hideTimer);
	overlay._hideTimer = setTimeout(() => {
		overlay.style.display = 'none';
	}, 1000);
}

function setSpeed(rate) {
	const videos = document.querySelectorAll('video');
	videos.forEach(v => v.playbackRate = rate);
	sessionStorage.setItem('playbackRate', rate);

	if (rate !== defaultRate) {
		lastSpeed = rate;
	}

	showSpeedOverlay(rate);
}

function getCurrentSpeed() {
	return parseFloat(sessionStorage.getItem('playbackRate')) || defaultRate;
}

function setCurrentTimeUp(seconds = 1) {
	const video = document.querySelector('video');
	if (video) {
		video.currentTime = Math.min(video.duration, video.currentTime + seconds);
	}
}

function setCurrentTimeDown(seconds = 1) {
	const video = document.querySelector('video');
	if (video) {
		video.currentTime = Math.max(0, video.currentTime + seconds);
	}
}

function freezeFrame(direction = 1) {
	const video = document.querySelector('video');
	if (!video) return;

	const fps = 30; // should b 30 most of the time...right?
	if (!video.paused) video.pause();

	video.currentTime += direction / fps;
}

function adjustSpeed(key) {
	const current = getCurrentSpeed();
	let newSpeed = current;

	switch (key) {
		case 'z':
			newSpeed = current === defaultRate ? lastSpeed : defaultRate;
			break;
		case 'x':
			newSpeed = Math.max(minRate, current - rateStep);
			break;
		case 'c':
			newSpeed = Math.min(maxRate, current + rateStep);
			break;
		case '1':
		case '2':
		case '3':
		case '4':
		case '5':
		case '6':
		case '7':
		case '8':
		case '9':
			newSpeed = parseInt(key, 10);
			break;
	}
	if (newSpeed !== current) setSpeed(newSpeed);
}

function onSpeedHotkey(e) {
	const activeTag = document.activeElement.tagName.toLowerCase();
	// prevent trigger on input
	if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
		return;
	}

	const key = e.key.toLowerCase();
	const keyCode = e.keyCode;

	// ctrl + arrow
	if (e.ctrlKey && keyCode === 39) {
		e.preventDefault();
		e.stopImmediatePropagation();
		setCurrentTimeUp(30);
		return;
	}
	if (e.ctrlKey && keyCode === 37) {
		e.preventDefault();
		e.stopImmediatePropagation();
		setCurrentTimeDown(-30);
		return;
	}

	// f & d for frame freeze
	if (keyCode === 70) {
		e.preventDefault();
		e.stopImmediatePropagation();
		freezeFrame(1);
		return;
	}
	if (keyCode === 68) {
		e.preventDefault();
		e.stopImmediatePropagation();
		freezeFrame(-1);
		return;
	}

	// speed
	const isTargetKey = /^[zxc12345678]$/.test(key);
	if (isTargetKey) {
		e.stopImmediatePropagation();
		e.preventDefault();
		adjustSpeed(key);
	}
}

function waitForYoutubePlayer(callback) {
	const check = () => {
		const player = document.querySelector('video');
		if (player) {
			player.addEventListener('ratechange', () => {
				sessionStorage.setItem('playbackRate', player.playbackRate);
			});

			player.addEventListener('volumechange', () => {
				if (!player._boost) player._boost = 1;
			});

			callback(player);
		} else {
			requestAnimationFrame(check);
		}
	};
	check();
}

function syncVideoState() {
	const video = document.querySelector('video');
	if (!video) return;

	// session storage
	const savedSpeed = parseFloat(sessionStorage.getItem('playbackRate'));
	if (savedSpeed && savedSpeed !== video.playbackRate) {
		video.playbackRate = savedSpeed;
	} else if (!savedSpeed) {
		sessionStorage.setItem('playbackRate', video.playbackRate);
	}

	// init boost tracking
	if (!video._boost) {
		video._boost = 1;
	}

	// init last volume
	const currentVol = Math.round((video.volume * 100) * (video._boost || 1));
	if (currentVol > 0) {
		lastVolume = currentVol;
	}
}

function applyBoostedVolume(totalPercent) {
	const video = document.querySelector('video');
	if (!video) return;

	const clamped = Math.max(0, Math.min(600, totalPercent));

	// update last vol if not muted
	if (clamped > 0) {
		lastVolumePercent = clamped;
	}

	sessionStorage.setItem("volumeBoost", clamped);

	const base = Math.min(1, clamped / 100);
	const boost = clamped > 100 ? clamped / 100 : 1;
	const cappedBoost = Math.min(boost, 6);

	video.volume = base;
	video._boost = boost;

	if (boost > 1) {
		if (!video._gainNode) {
			try {
				const ctx = video._audioCtx || new (window.AudioContext || window.webkitAudioContext)();
				const source = video._mediaSource || ctx.createMediaElementSource(video);
				const gainNode = ctx.createGain();
				source.connect(gainNode).connect(ctx.destination);

				video._audioCtx = ctx;
				video._gainNode = gainNode;
				video._mediaSource = source;
			} catch (e) {
				console.warn('Could not create audio context for volume boost:', e);
				return;
			}
		}
		if (video._audioCtx?.state === "suspended") {
			video._audioCtx.resume().catch(err =>
				console.warn('Failed to resume AudioContext:', err)
			);
		}

		if (video._gainNode) {
			video._gainNode.gain.value = cappedBoost;
		}
	} else {
		if (video._gainNode) {
			video._gainNode.gain.value = 1;
		}
	}
}

const siteHooks = {
	'default': {
		onReady: () => {
			window.addEventListener('keydown', onSpeedHotkey, true);
			syncVideoState();
		}
	}
};

(function() {
	// shadow dom first
	hackAttachShadow();

	// watch for vids for videos
	ready("video", enhanceVideo);

	const hostname = location.hostname;
	const site = Object.keys(siteHooks).find(k => hostname.includes(k)) || 'default';
	waitForYoutubePlayer(siteHooks[site].onReady);

	// try to get curr speed
	const saved = getCurrentSpeed();
	if (saved !== defaultRate) {
		setTimeout(() => setSpeed(saved), 500);
	}
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	const video = document.querySelector('video');

	switch (message.type) {
		case "getStatus":
			if (!video) {
				sendResponse({ status: "no_video" });
				return;
			}

			// get curr values
			const actualSpeed = video.playbackRate || defaultRate;
			const actualVolume = Math.round((video.volume * 100) * (video._boost || 1));

			const status = {
				type: "statusUpdate",
				speed: actualSpeed,
				volume: actualVolume
			};
			sendResponse(status);
			break;

		case "changeSpeed":
			if (!video) {
				sendResponse({ status: "no_video" });
				return;
			}

			const newSpeed = Math.max(0.1, Math.min(16, video.playbackRate + message.value));
			setSpeed(newSpeed);

			sendResponse({
				type: "statusUpdate",
				speed: newSpeed,
				volume: Math.round((video.volume * 100) * (video._boost || 1))
			});
			break;

		case "changeVolume":
			if (!video) {
				sendResponse({ status: "no_video" });
				return;
			}

			const currentVolume = Math.round((video.volume * 100) * (video._boost || 1));
			const newVolume = currentVolume + message.value;
			applyBoostedVolume(newVolume);

			sendResponse({
				type: "statusUpdate",
				speed: video.playbackRate,
				volume: Math.round((video.volume * 100) * (video._boost || 1))
			});
			break;

		case "setVolume":
			if (!video) {
				sendResponse({ status: "no_video" });
				return;
			}

			applyBoostedVolume(message.value);

			sendResponse({
				type: "statusUpdate",
				speed: video.playbackRate,
				volume: Math.round((video.volume * 100) * (video._boost || 1))
			});
			break;

		case "mute":
			if (!video) {
				sendResponse({ status: "no_video" });
				return;
			}

			const currentVol = Math.round((video.volume * 100) * (video._boost || 1));
			const targetVol = currentVol === 0 ? lastVolumePercent : 0;

			applyBoostedVolume(targetVol);

			sendResponse({
				type: "statusUpdate",
				speed: video.playbackRate,
				volume: Math.round((video.volume * 100) * (video._boost || 1))
			});
			break;
	}

	return true;
});
