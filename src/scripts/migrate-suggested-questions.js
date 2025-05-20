// This script will migrate the suggestedQuestions field in the AppSettings collection
// from an array of strings to an array of objects with question and answer properties

// Run this script with: node src/scripts/migrate-suggested-questions.js

require('dotenv').config();
const mongoose = require('mongoose');
const { Schema } = mongoose;

async function main() {
    console.log('Starting migration of suggestedQuestions field...');

    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Define schemas
        const SuggestedQuestionSchema = new Schema({
            question: { type: String, required: true },
            answer: { type: String, required: true },
        }, { _id: false });

        const AppSettingsSchema = new Schema({
            suggestedQuestions: { type: [Schema.Types.Mixed] }, // Accept any type during migration
            // Other fields not needed for this migration
        });

        // Create model
        const AppSettingsModel = mongoose.model('AppSettings', AppSettingsSchema);

        // Find the app settings document
        const settings = await AppSettingsModel.findOne({});

        if (!settings) {
            console.log('No app settings found. Nothing to migrate.');
            return;
        }

        console.log('Current suggestedQuestions:', settings.suggestedQuestions);

        // Check if migration is needed
        let needsMigration = false;
        if (Array.isArray(settings.suggestedQuestions)) {
            needsMigration = settings.suggestedQuestions.some(q => typeof q === 'string');
        }

        if (!needsMigration) {
            console.log('suggestedQuestions already in the correct format. No migration needed.');
            return;
        }

        // Migrate string questions to objects with question and answer properties
        const migratedQuestions = settings.suggestedQuestions.map(q => {
            if (typeof q === 'string') {
                return {
                    question: q,
                    answer: 'Không có câu trả lời được đặt trước cho câu hỏi này.'
                };
            }
            return q; // Keep objects as is
        });

        console.log('Migrated suggestedQuestions:', migratedQuestions);

        // Update the database with the migrated questions
        await AppSettingsModel.updateOne(
            { _id: settings._id },
            { $set: { suggestedQuestions: migratedQuestions } }
        );

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

main().catch(console.error); 