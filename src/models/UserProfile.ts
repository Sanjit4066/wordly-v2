import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProfile extends Document {
  userId: string;
  displayName: string;
  photoURL: string;
  dob: string;
  bio: string;
  githubId: string;
  linkedinId: string;
  instagramId: string;
  maxStreak: number;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      default: 'Learner',
    },
    photoURL: {
      type: String,
      default: '',
    },
    dob: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    githubId: {
      type: String,
      default: '',
    },
    linkedinId: {
      type: String,
      default: '',
    },
    instagramId: {
      type: String,
      default: '',
    },
    maxStreak: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'user_profiles',
  }
);

const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
export default UserProfile;
