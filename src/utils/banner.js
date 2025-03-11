// src/utils/banner.js
const figlet = require('figlet');
const chalk = require('chalk');
const logger = require('./logger');

/**
 * Generate an ASCII art banner with shadow effect
 * @param {string} text - Text to display in the banner
 * @returns {string} Formatted banner string
 */
function generateBanner(text = 'Fhenix Nitrogen') {
    try {
        // Generate ASCII art text with 'ANSI Shadow' font
        const figletText = figlet.textSync(text, {
            font: 'ANSI Shadow',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            width: 120
        });
        
        // Apply color to the ascii art: cyan for main text
        const coloredText = chalk.cyan(figletText);
        
        // Create border
        const width = Math.max(...figletText.split('\n').map(line => line.length));
        const border = chalk.blue('═'.repeat(width));
        
        // Create the full banner with timestamp
        const timestamp = logger.getInstance().getTimestamp();
        
        // Return the full banner
        return `\n${border}\n${coloredText}\n${border}\n${chalk.blue(timestamp)} ${chalk.white.bold('Automation Started')}\n`;
    } catch (error) {
        // Fallback if figlet fails
        console.error(`Error generating banner: ${error.message}`);
        return `\n${chalk.cyan.bold('===== Fhenix Nitrogen Testnet Automation Tool =====')}\n`;
    }
}

/**
 * Display banner to console
 */
function showBanner() {
    console.log(generateBanner());
}

module.exports = {
    generateBanner,
    showBanner
};