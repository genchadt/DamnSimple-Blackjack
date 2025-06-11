// src/game/playerfunds-ts
// Use centralized constants
import { GameStorage } from "./GameStorage";
import { Constants } from "../Constants";

/**
 * PlayerFunds class manages the player's funds in the game.
 * It allows adding, deducting, and resetting funds,
 * as well as saving and loading funds from persistent storage.
 */
export class PlayerFunds {
    private funds: number;

    /**
     * Initializes PlayerFunds with default funds.
     * Loads funds from GameStorage or uses a default value.
     */
     public static readonly instance = new PlayerFunds();
    constructor() {
        this.funds = GameStorage.loadFunds(Constants.DEFAULT_FUNDS);
        console.log("PlayerFunds Initialized. Funds:", this.funds);
    }

    /**
     * Gets the current amount of funds.
     * @returns The current funds.
     */
    public getFunds(): number {
        return this.funds;
    }

    /**
     * Directly sets the player's funds. Use with caution (e.g., for debug or loading).
     * Saves the new amount.
     */
    public setFunds(amount: number): void {
        if (amount >= 0) {
            this.funds = amount;
            this.saveFunds();
        } else {
            console.error("Cannot set negative funds.");
        }
    }

    /**
     * Adds funds to the player's total.
     * @param amount The amount to add. Should be non-negative.
     * If negative, logs a warning and does nothing.
     * @returns void
     */
    public addFunds(amount: number): void {
        if (amount < 0) {
            console.warn("Use deductFunds for negative amounts.");
            return;
        }
        this.funds += amount;
        this.saveFunds();
        console.log(`Added ${amount} funds. New total: ${this.funds}`);
    }

    /**
     * Deducts funds from the player's total.
     * @param amount The amount to deduct. Should be non-negative and not exceed current funds.
     * @returns True if deduction was successful, false otherwise.
     */
    public deductFunds(amount: number): boolean {
        if (amount < 0) {
            console.warn("Use addFunds for positive amounts.");
            return false; // Indicate failure for negative deduction
        }
        if (amount > this.funds) {
            console.warn(`Cannot deduct ${amount}. Insufficient funds: ${this.funds}`);
            return false; // Indicate failure
        }
        this.funds -= amount;
        this.saveFunds();
        console.log(`Deducted ${amount} funds. New total: ${this.funds}`);
        return true; // Indicate success
    }

    /**
     * Resets the player's funds to a default value.
     * This is useful for starting a new game or resetting the game state.
     */
    public resetFunds(): void {
        console.log(`Resetting funds from ${this.funds} to ${Constants.DEFAULT_FUNDS}`);
        this.funds = Constants.DEFAULT_FUNDS;
        this.saveFunds();
    }

    /**
     * Saves the current funds to persistent storage.
     * This is called after any change to the funds.
     */
    private saveFunds(): void {
        GameStorage.saveFunds(this.funds);
    }
}
