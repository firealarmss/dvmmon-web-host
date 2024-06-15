const socket = io();
let siteData = null;

socket.on('update', (data) => {
    console.log('Received update from server:', data);
    siteData = data;
    const sitesDiv = document.getElementById('sites');
    sitesDiv.innerHTML = '';

    data.sites.forEach(site => {
        const siteDiv = document.createElement('div');
        siteDiv.className = 'col-md-4';
        siteDiv.innerHTML = `
                <div class="site-box mb-4" id="site-${site.name}">
                    <h2>${site.name}</h2>
                    <div class="control-channels-container"></div>
                    <div class="repeaters-container"></div>
                </div>
            `;
        sitesDiv.appendChild(siteDiv);

        const controlChannelsContainer = siteDiv.querySelector('.control-channels-container');
        const repeatersContainer = siteDiv.querySelector('.repeaters-container');

        if (site.controlChannels) {
            site.controlChannels.forEach(controlChannel => {
                const controlChannelDivId = `control-channel-${site.name}-${controlChannel.channelId}`;
                let controlChannelDiv = document.getElementById(controlChannelDivId);

                if (controlChannel.status !== 200) {
                    console.log('Control channel status is not 200, skipping:', controlChannel.status);
                    if (controlChannelDiv) {
                        controlChannelDiv.classList.add('inactive');
                    }
                    return;
                }

                if (!controlChannelDiv) {
                    controlChannelDiv = document.createElement('div');
                    controlChannelDiv.className = 'control-channel-box mb-4';
                    controlChannelDiv.id = controlChannelDivId;
                    controlChannelDiv.innerHTML = `
                            <h3>Control Channel ${controlChannel.channelNo}</h3>
                            <p>Tx Frequency: ${controlChannel.modem ? formatFrequency(controlChannel.modem.txFrequencyEffective) : 'N/A'}</p>
                            <p>Rx Frequency: ${controlChannel.modem ? formatFrequency(controlChannel.modem.rxFrequencyEffective) : 'N/A'}</p>
                            <div class="voice-channels-list"></div>
                        `;
                    controlChannelsContainer.appendChild(controlChannelDiv);
                } else {
                    controlChannelDiv.classList.remove('inactive');
                }

                const voiceChannelsList = controlChannelDiv.querySelector('.voice-channels-list');
                if (controlChannel.voiceChannels) {
                    controlChannel.voiceChannels.forEach(voiceChannel => {
                        const existingVoiceChannelDiv = document.getElementById(`voice-channel-${voiceChannel.channelNo}`);
                        if (voiceChannel.tx) {
                            if (!existingVoiceChannelDiv) {
                                const voiceChannelDiv = document.createElement('div');
                                voiceChannelDiv.className = 'voice-channel card mb-2 keyed';
                                voiceChannelDiv.id = `voice-channel-${voiceChannel.channelNo}`;
                                voiceChannelDiv.innerHTML = `
                                        <div class="card-body">
                                            <h5 class="card-title">Voice Channel: ${voiceChannel.channelNo}</h5>
                                            <p class="card-text">Tx Frequency: ${voiceChannel.modem ? formatFrequency(voiceChannel.modem.txFrequencyEffective) : 'N/A'}</p>
                                            <p class="card-text">Rx Frequency: ${voiceChannel.modem ? formatFrequency(voiceChannel.modem.rxFrequencyEffective) : 'N/A'}</p>
                                            <p class="card-text">Last Dst: ${voiceChannel.lastDstId}</p>
                                            <p class="card-text">Last Src: ${voiceChannel.lastSrcId}</p>
                                        </div>
                                    `;
                                voiceChannelsList.appendChild(voiceChannelDiv);
                            } else {
                                existingVoiceChannelDiv.classList.add('keyed');
                            }
                        } else if (existingVoiceChannelDiv) {
                            existingVoiceChannelDiv.classList.remove('keyed');
                            setTimeout(() => {
                                existingVoiceChannelDiv.remove();
                            }, 2000);
                        }
                    });
                }
            });
        }

        if (site.repeaters) {
            site.repeaters.forEach(repeater => {
                const repeaterDivId = `repeater-${site.name}-${repeater.channelId}`;
                let repeaterDiv = document.getElementById(repeaterDivId);

                if (!repeaterDiv) {
                    repeaterDiv = document.createElement('div');
                    repeaterDiv.className = 'repeater-box mb-4';
                    repeaterDiv.id = repeaterDivId;
                    repeaterDiv.classList.add('control-channel-box');
                    repeaterDiv.innerHTML = `
                            <h3>Repeater ${repeater.channelNo}</h3>
                            <p>Tx Frequency: ${repeater.modem ? formatFrequency(repeater.modem.txFrequencyEffective) : 'N/A'}</p>
                            <p>Rx Frequency: ${repeater.modem ? formatFrequency(repeater.modem.rxFrequencyEffective) : 'N/A'}</p>
                            <p class="card-text">Last Dst: ${repeater.lastDstId ? 0 : "None"}</p>
                            <p class="card-text">Last Src: ${repeater.lastSrcId ? 0 : "None"}</p>
                        `;
                    repeatersContainer.appendChild(repeaterDiv);
                }

                if (repeater.tx) {
                    repeaterDiv.classList.add('keyed');
                } else {
                    repeaterDiv.classList.remove('keyed');
                }
            });
        }
    });
});

$('#commandModal').on('show.bs.modal', function (event) {
    const channelSelect = document.getElementById('channelSelect');
    channelSelect.innerHTML = '';

    if (siteData) {
        siteData.sites.forEach(site => {
            site.controlChannels.forEach(controlChannel => {
                if (controlChannel.status === 200) {
                    const option = document.createElement('option');
                    option.value = `${site.name}-${controlChannel.channelId}`;
                    option.text = `${site.name} - Control Channel ${controlChannel.channelNo}`;
                    channelSelect.appendChild(option);
                }
            });
        });
    }
});

document.getElementById('commandForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const commandType = document.getElementById('commandType').value;
    const channelSelect = document.getElementById('channelSelect').value;
    const dstId = document.getElementById('dstId').value;

    const [siteName, channelId] = channelSelect.split('-');
    const site = siteData.sites.find(site => site.name === siteName);
    const controlChannel = site.controlChannels.find(channel => channel.channelId === parseInt(channelId));

    if (!controlChannel) {
        alert('Invalid channel selected');
        return;
    }

    try {
        const response = await fetch(`/api/command`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: commandType,
                dstId,
                address: controlChannel.address,
                port: controlChannel.port,
                password: controlChannel.password
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Command sent successfully');
        } else {
            alert(`Error sending command: ${result.message}`);
        }
    } catch (error) {
        console.error('Error sending command:', error);
        alert('Error sending command');
    }
});

function formatFrequency(frequency) {
    const frequencyStr = frequency.toString().padStart(9, '0');
    return `${frequencyStr.slice(0, 3)}.${frequencyStr.slice(3, 6)}.${frequencyStr.slice(6, 9)}`;
}