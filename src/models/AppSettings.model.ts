// src/models/AppSettings.model.ts
import mongoose, { Schema, Document, models, Model } from 'mongoose';
import type { AppSettings, SpecificDayRule, SuggestedQuestion } from '@/lib/types'; // Import SpecificDayRule and SuggestedQuestion

// Subdocument schema for SpecificDayRule
const SpecificDayRuleSchema: Schema<SpecificDayRule> = new Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  isOff: { type: Boolean },
  workingHours: [{ type: String }], // Array of "HH:MM"
  numberOfStaff: { type: Number },
  serviceDurationMinutes: { type: Number },
}, { _id: true }); // Mongoose will add _id automatically, which we can map to 'id'

// Subdocument schema for SuggestedQuestion
const SuggestedQuestionSchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
}, { _id: false }); // No _id for this subdocument

export interface IAppSettings extends Document, Omit<AppSettings, 'id' | 'specificDayRules' | 'suggestedQuestions'> {
  // id is managed by MongoDB as _id
  specificDayRules?: mongoose.Types.DocumentArray<SpecificDayRule>; // Use Mongoose's DocumentArray for subdocuments
  suggestedQuestions?: any[]; // Allow both string[] and SuggestedQuestion[] 
}

const AppSettingsSchema: Schema<IAppSettings> = new Schema({
  greetingMessage: { type: String, default: 'Tôi là trợ lý AI của bạn. Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi về dịch vụ hoặc đặt lịch hẹn.' },
  // Use Schema.Types.Mixed for flexibility with both string[] and SuggestedQuestion[]
  suggestedQuestions: {
    type: [Schema.Types.Mixed],
    default: [
      { question: 'Dịch vụ của bạn là gì?', answer: 'Chúng tôi cung cấp dịch vụ tư vấn, đặt lịch hẹn và hỗ trợ khách hàng.' },
      { question: 'Làm thế nào để đặt lịch hẹn?', answer: 'Bạn có thể đặt lịch hẹn bằng cách cho tôi biết thời gian và dịch vụ bạn muốn.' }
    ]
  },
  brandName: { type: String, default: 'AetherChat' },
  logoUrl: { type: String }, // Made optional, can be an external URL
  logoDataUri: { type: String }, // For storing base64 encoded logo
  footerText: { type: String, default: `© ${new Date().getFullYear()} AetherChat. Đã đăng ký Bản quyền.` },
  metaTitle: { type: String, default: 'AetherChat - Live Chat Thông Minh' },
  metaDescription: { type: String, default: 'Live chat tích hợp AI cho giao tiếp khách hàng liền mạch.' },
  metaKeywords: [{ type: String }],
  openGraphImageUrl: { type: String },
  robotsTxtContent: { type: String },
  sitemapXmlContent: { type: String },

  // Scheduling Rules
  numberOfStaff: { type: Number, default: 1, min: 0 },
  defaultServiceDurationMinutes: { type: Number, default: 60, min: 5 },
  workingHours: {
    type: [String],
    default: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
  }, // Example: "HH:MM"
  weeklyOffDays: [{ type: Number, min: 0, max: 6 }], // 0 for Sunday, 6 for Saturday
  oneTimeOffDates: [{ type: String }], // "YYYY-MM-DD"
  specificDayRules: [SpecificDayRuleSchema],

}, { timestamps: true, versionKey: false });

const AppSettingsModel = models.AppSettings as Model<IAppSettings> || mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

export default AppSettingsModel;
