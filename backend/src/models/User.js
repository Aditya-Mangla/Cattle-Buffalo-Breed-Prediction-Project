import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { 
      type: String, 
      required: true, 
      minlength: 6 
    },
    role: { 
      type: String, 
      enum: ['user', 'admin'], 
      default: 'user' 
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);
