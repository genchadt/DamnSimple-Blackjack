// src/game/playerfunds-ts
// Use centralized constants
import { GameStorage } from "./GameStorage";
import { Constants } from "../Constants"; // *** IMPORT Constants ***

export class PlayerFunds {
    // *** REMOVED static DEFAULT_FUNDS ***
    private funds: number;

    constructor() {
        // *** USE Constant for default funds ***
        this.funds = GameStorage.loadFunds(Constants.DEFAULT_FUNDS);
        console.log("PlayerFunds Initialized. Funds:", this.funds);
    }

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


    public addFunds(amount: number): void {
        if (amount < 0) {
            console.warn("Use deductFunds for negative amounts.");
            return;
        }
        this.funds += amount;
        this.saveFunds();
        console.log(`Added ${amount} funds. New total: ${this.funds}`);
    }

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

    public resetFunds(): void {
        // *** USE Constant for default funds ***
        console.log(`Resetting funds from ${this.funds} to ${Constants.DEFAULT_FUNDS}`);
        this.funds = Constants.DEFAULT_FUNDS;
        this.saveFunds();
    }

    // Save funds using GameStorage
    private saveFunds(): void {
        GameStorage.saveFunds(this.funds);
    }
}
