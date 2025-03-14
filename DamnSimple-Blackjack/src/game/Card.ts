// ./game/Card.ts
export enum Suit {
    Hearts = "Hearts",
    Diamonds = "Diamonds",
    Clubs = "Clubs",
    Spades = "Spades"
}

export enum Rank {
    Two = "2",
    Three = "3",
    Four = "4",
    Five = "5",
    Six = "6",
    Seven = "7",
    Eight = "8",
    Nine = "9",
    Ten = "10",
    Jack = "J",
    Queen = "Q",
    King = "K",
    Ace = "A"
}

export class Card {
    private suit: Suit;
    private rank: Rank;
    private faceUp: boolean;

    constructor(suit: Suit, rank: Rank) {
        this.suit = suit;
        this.rank = rank;
        this.faceUp = false;
    }

    public getSuit(): Suit {
        return this.suit;
    }

    public getRank(): Rank {
        return this.rank;
    }

    public isFaceUp(): boolean {
        return this.faceUp;
    }

    public flip(): void {
        this.faceUp = !this.faceUp;
    }

    public getValue(): number {
        switch (this.rank) {
            case Rank.Ace:
                return 11; // Aces are 11 or 1 in Blackjack
            case Rank.Jack:
            case Rank.Queen:
            case Rank.King:
                return 10;
            default:
                return parseInt(this.rank);
        }
    }

    public toString(): string {
        return `${this.rank} of ${this.suit}`;
    }
}
