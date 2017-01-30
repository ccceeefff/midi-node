'use strict';

var Message = require('./message');
var constants = require('./constants');
var vlv = require('./vlv');

function Track(params) {
	this.size = params.size;
	this.events = [];
	this.complete = false;
}

/**
 * Adds a message with delta to the track.
 * Will complete the track if the message is a end of track message.
 *
 * @param delta delta in ticks
 * @param message message object
 * @throws Error if the track is already completed.
 */
Track.prototype.addEvent = function (delta, message) {
	if (this.complete) {
		throw new Error('Tried to add a event to a completed track.');
	}
	this.events.push({
		delta: delta,
		message: message
	});

	if (message.isEndOfTrack()) {
		this.complete = true;
	}
};

/**
 * This is the length in bytes of the track according to the header.
 * Documentation shows that this is not very reliable. The actual track can be
 * longer or shorter.
 *
 * @returns {number}
 */
Track.prototype.length = function () {
	return this.size + 8;
};

/**
 * Parses a empty track from a buffer. The buffer must contain the header.
 *
 * @param buffer
 * @returns {Track}
 */
Track.fromBuffer = function (buffer) {
	var offset = 0;

	if (buffer.readUInt32BE(offset) !== constants.START_OF_TRACK) {
		throw new Error("Track did not start with 'MTrk'.");
	}

	offset += 4;
	var size = buffer.readUInt32BE(offset);

	return new Track({size: size});
};

/**
 * Writes the entire track out into a buffer
 *
 * @returns {Buffer}
 */
Track.prototype.toBuffer = function(){
     var buffer = Buffer.alloc(constants.TRACK_HEADER_LENGTH);
     buffer.writeInt32BE(constants.START_OF_TRACK, 0);
     var size = this.size;
     if (!size) {
          size = 0;
     }
     buffer.writeInt32BE(size, 4);

     this.events.forEach(function(event){
          buffer = Buffer.concat([
               buffer,
               vlv.toBuffer(event.delta),
               new Buffer([event.message.statusByte]),
               new Buffer(event.message.data)
          ]);
     });
     return buffer;
};

module.exports = Track;