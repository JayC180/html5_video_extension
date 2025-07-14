function sendToContentScript(message, callback) {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		if (tabs.length === 0) {
			return;
		}

		chrome.tabs.sendMessage(tabs[0].id, message, response => {
			if (chrome.runtime.lastError) {
				console.error('Error sending message:', chrome.runtime.lastError.message);
				document.getElementById("speedDisplay").textContent = "N/A";
				document.getElementById("volumeDisplay").textContent = "N/A";
				return;
			}

			if (callback) callback(response);
			if (message.type === "getStatus" && response) {
				updateUI(response);
			}
		});
	});
}

function updateDisplays() {
	sendToContentScript({ type: "getStatus" });
}

function updateDisplaysWithRetry(attempts = 3, delay = 100) {
	if (attempts <= 0) {
		console.error('Failed to get status after multiple attempts');
		return;
	}

	sendToContentScript({ type: "getStatus" }, (response) => {
		if (!response || response.status === "no_video") {
			// delay then retry
			setTimeout(() => updateDisplaysWithRetry(attempts - 1, delay * 2), delay);
		} else {
			updateUI(response);
		}
	});
}

function updateUI(msg) {
	if (msg && msg.speed !== undefined && msg.volume !== undefined) {
		document.getElementById("speedDisplay").textContent = msg.speed.toFixed(2) + "x";
		document.getElementById("volumeDisplay").textContent = msg.volume + "%";
		document.getElementById("volumeSlider").value = msg.volume;

		const muteButton = document.getElementById("mute");
		muteButton.textContent = msg.volume === 0 ? "Unmute" : "Mute";
	}
}

document.addEventListener('DOMContentLoaded', function() {
	// buttons
	document.getElementById("dec1").onclick = () => {
		sendToContentScript({ type: "changeSpeed", value: -1 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("dec01").onclick = () => {
		sendToContentScript({ type: "changeSpeed", value: -0.1 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("inc01").onclick = () => {
		sendToContentScript({ type: "changeSpeed", value: 0.1 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("inc1").onclick = () => {
		sendToContentScript({ type: "changeSpeed", value: 1 }, (response) => {
			if (response) updateUI(response);
		});
	};

	document.getElementById("volDec100").onclick = () => {
		sendToContentScript({ type: "changeVolume", value: -100 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("volDec10").onclick = () => {
		sendToContentScript({ type: "changeVolume", value: -10 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("volInc10").onclick = () => {
		sendToContentScript({ type: "changeVolume", value: 10 }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("volInc100").onclick = () => {
		sendToContentScript({ type: "changeVolume", value: 100 }, (response) => {
			if (response) updateUI(response);
		});
	};

	document.getElementById("mute").onclick = () => {
		sendToContentScript({ type: "mute" }, (response) => {
			if (response) updateUI(response);
		});
	};
	document.getElementById("resetVolume").onclick = () => {
		sendToContentScript({ type: "setVolume", value: 100 }, (response) => {
			if (response) updateUI(response);
		});
	};

	document.getElementById("volumeSlider").oninput = (e) => {
		sendToContentScript({ type: "setVolume", value: parseInt(e.target.value) }, (response) => {
			if (response) updateUI(response);
		});
	};

	updateDisplaysWithRetry();
});
