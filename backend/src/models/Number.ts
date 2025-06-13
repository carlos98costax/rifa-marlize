const mongoose = require('mongoose');

const numberSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  buyer: {
    type: String,
    default: ''
  },
  selected: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Number', numberSchema); 