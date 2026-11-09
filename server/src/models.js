import mongoose from 'mongoose';
import crypto from 'crypto';

const { Schema, model } = mongoose;

const User = model('User', new Schema({
  voterId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['voter', 'admin'], default: 'voter' },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const Election = model('Election', new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  kind: { type: String, enum: ['candidates', 'proposal'], default: 'candidates' },
  options: [{ name: { type: String, required: true }, description: String }],
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  resultsPublished: { type: Boolean, default: false },
  results: [{ optionId: String, name: String, votes: Number }],
  totalVotes: { type: Number, default: 0 },
}, { timestamps: true }));

// Records THAT a user voted, never WHAT they voted.
const partSchema = new Schema({
  election: { type: Schema.Types.ObjectId, ref: 'Election', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
partSchema.index({ election: 1, user: 1 }, { unique: true });
const Participation = model('Participation', partSchema);

// Records WHAT was voted, never WHO voted. Random id and no timestamps on purpose.
const Ballot = model('Ballot', new Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  election: { type: Schema.Types.ObjectId, ref: 'Election', required: true, index: true },
  ct: String, iv: String, tag: String,
  receiptHash: { type: String, index: true },
}, { timestamps: false }));

const Audit = model('Audit', new Schema({
  seq: { type: Number, unique: true },
  action: String,
  actor: String,
  details: Schema.Types.Mixed,
  at: Date,
  prevHash: String,
  hash: String,
}));

export { User, Election, Participation, Ballot, Audit };
