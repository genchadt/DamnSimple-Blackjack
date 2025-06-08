// src/game/scorecalculator-ts
// Added detailed logging to calculateHandValue
import { Card, Rank } from "./Card"; // Import Rank

export class ScoreCalculator {
    /**
     * Calculates the total value of a hand in Blackjack, optimally valuing Aces as either 1 or 11.
     * Considers ALL cards in the hand, regardless of face-up state.
     *
     * @param hand - The hand of cards to calculate the value for.
     * @returns The total value of the hand. Returns 0 for an empty hand.
     */
    public static calculateHandValue(hand: Card[]): number {
        // *** ADDED Log: Start Calculation ***
        const handDesc = hand.map(c => c.toString()).join(', ');
        // console.log(`%c[ScoreCalc] Calculating value for hand: [${handDesc}]`, 'color: #6495ED'); // CornflowerBlue // Reduce log noise

        if (!hand || hand.length === 0) {
            // console.log(`%c[ScoreCalc]   -> Hand empty, returning 0.`, 'color: #6495ED'); // Reduce log noise
            return 0;
        }

        let value = 0;
        let aceCount = 0;

        // First pass: Add card values, count Aces as 11 initially
        for (const card of hand) {
            const cardValue = card.getValue(); // getValue() returns 11 for Ace
            if (card.getRank() === Rank.Ace) { // Use Rank enum for comparison
                aceCount++;
                value += 11; // Add Ace as 11 initially
                // *** ADDED Log: Ace Found ***
                // console.log(`%c[ScoreCalc]   -> Found Ace. Current value: ${value}, Ace count: ${aceCount}`, 'color: #6495ED'); // Reduce log noise
            } else {
                value += cardValue;
                // *** ADDED Log: Non-Ace Found ***
                // console.log(`%c[ScoreCalc]   -> Found ${card.toString()} (${cardValue}). Current value: ${value}, Ace count: ${aceCount}`, 'color: #6495ED'); // Reduce log noise
            }
        }
        // *** ADDED Log: After Initial Sum ***
        // console.log(`%c[ScoreCalc]   -> Initial sum complete. Value: ${value}, Ace count: ${aceCount}`, 'color: #6495ED; font-weight: bold;'); // Reduce log noise


        // Second pass: Adjust Ace value from 11 to 1 if score exceeds 21
        while (value > 21 && aceCount > 0) {
            // *** ADDED Log: Adjusting Ace ***
            // console.log(`%c[ScoreCalc]   -> Value (${value}) > 21 and aceCount (${aceCount}) > 0. Adjusting Ace (11 -> 1).`, 'color: orange; font-weight: bold;'); // Reduce log noise
            value -= 10; // Change one Ace from 11 to 1
            aceCount--;
            // *** ADDED Log: After Adjustment ***
            // console.log(`%c[ScoreCalc]   -> Value after adjustment: ${value}, Remaining aceCount: ${aceCount}`, 'color: orange;'); // Reduce log noise
        }

        // *** ADDED Log: Final Value ***
        // console.log(`%c[ScoreCalc] Final calculated value: ${value}`, 'color: #6495ED; font-weight: bold;'); // Reduce log noise
        return value;
    }
}
