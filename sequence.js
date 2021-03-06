'use strict';

var Message = require('./message');
var Track = require('./track');
var vlv = require('./vlv');
var constants = require('./constants');

var fileTypes = {
	TYPE_0: 0x0, // single track
	TYPE_1: 0x1 // multi track
};

function Sequence(header) {
	this.tracks = [];
	this.header = header;
}

Sequence.prototype.addTrack = function (track) {
	if (this.tracks.length >= this.header.noTracks) {
		console.warn('Tracks exceed specified number of tracks in header field.');
	}
	this.tracks.push(track);
};

Sequence.prototype.getTracks = function () {
	return this.tracks;
};

Sequence.prototype.getFileType = function () {
	return this.header.fileType;
};

Sequence.prototype.getTicks = function () {
	return this.header.ticks;
};

/**
 * Generates a buffer containing the MIDI File header based on this sequence
 *
 * @return {Buffer}
 */
Sequence.prototype.getHeader = function(){
	var buffer = Buffer.alloc(constants.FILE_HEADER_LENGTH);
	buffer.writeUInt32BE(constants.START_OF_FILE, 0);
	buffer.writeUInt32BE(6, 4);	// number of bytes after header
	buffer.writeUInt16BE(this.header.fileType, 8);
	buffer.writeUInt16BE(this.header.noTracks, 10);
	buffer.writeUInt16BE(this.header.ticks, 12);
	return buffer;
}

/**
 *
 * @param buffer
 * @returns {Sequence}
 */
Sequence.fromBuffer = function (buffer) {
	var offset = 0;

	if (buffer.readUInt32BE(offset, false) !== constants.START_OF_FILE) {
		throw new Error("Expected start of file marker 'MThd'.");
	}
	offset += 4;

	if (buffer.readUInt32BE(offset) !== 0x6) {
		throw new Error('Invalid header size (expected 6 bytes).');
	}
	offset += 4;

	var fileType = buffer.readUInt16BE(offset);
	offset += 2;

	var noTracks = buffer.readUInt16BE(offset);
	offset += 2;

	if (fileType === fileTypes.TYPE_0 && noTracks !== 1) {
		throw new Error('Number of tracks mismatch file type (expected 1 track).');
	}

	var ticks = buffer.readUInt16BE(offset);
	offset += 2;

	var sequence = new Sequence({
		fileType: fileType,
		ticks: ticks,
		noTracks: noTracks
	});

	for (var i = 0; i < noTracks; i++) {
		var track = Track.fromBuffer(buffer.slice(offset));
		sequence.addTrack(track);
		offset += 8;

		var runningStatus = null;

		while (buffer.length > 0) {
			var delta = vlv.fromBuffer(buffer.slice(offset));
			// TODO fix this stuff
			if(delta > 0x1FFFFF){
				offset += 4;
			} else if (delta > 0x3FFF) {
				offset += 3;
			} else if (delta > 0x7F) {
				offset += 2;
			} else {
				offset += 1;
			}

			var message = Message.fromBuffer(buffer.slice(offset), runningStatus);
			if (!message) {
				throw new Error("Unexpected end of buffer.");
			}
			track.addEvent(delta, message);
			offset += message.length;
			runningStatus = message.statusByte;

			if (message.isEndOfTrack()) {
				break;
			}
		}
	}

	return sequence;
};

Sequence.fromFile = function (filename, cb) {
	require('fs').readFile(filename, function (error, data) {
		if (error) {
			cb(error, null);
			return;
		}
		cb(null, Sequence.fromBuffer(data));
	});
};

module.exports = Sequence;
