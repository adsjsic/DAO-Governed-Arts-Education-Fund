import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, asciiCV, principalCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_TITLE = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_INVALID_AMOUNT = 103;
const ERR_INVALID_RECIPIENT = 104;
const ERR_INVALID_DURATION = 105;
const ERR_PROPOSAL_ALREADY_EXISTS = 106;
const ERR_PROPOSAL_NOT_FOUND = 107;
const ERR_INVALID_PROPOSAL_TYPE = 119;
const ERR_INVALID_QUORUM = 122;
const ERR_INVALID_THRESHOLD = 123;
const ERR_INVALID_START_TIME = 120;
const ERR_INVALID_END_TIME = 121;
const ERR_INVALID_FUNDING_GOAL = 128;
const ERR_INVALID_MILESTONE = 129;
const ERR_MAX_PROPOSALS_EXCEEDED = 118;
const ERR_INVALID_UPDATE_PARAM = 117;
const ERR_PROPOSAL_NOT_ACTIVE = 124;
const ERR_VOTING_NOT_STARTED = 111;
const ERR_VOTING_ALREADY_ENDED = 112;
const ERR_ALREADY_VOTED = 113;
const ERR_PROPOSAL_ALREADY_APPROVED = 125;

interface Proposal {
  title: string;
  description: string;
  requestedAmount: number;
  recipient: string;
  duration: number;
  startTime: number;
  endTime: number;
  status: string;
  proposer: string;
  proposalType: string;
  quorum: number;
  threshold: number;
  votesFor: number;
  votesAgainst: number;
  fundingGoal: number;
  milestoneCount: number;
  reportSubmitted: boolean;
}

interface ProposalUpdate {
  updateTitle: string;
  updateDescription: string;
  updateAmount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProposalContractMock {
  state: {
    nextProposalId: number;
    maxProposals: number;
    proposalFee: number;
    governanceContract: string | null;
    proposals: Map<number, Proposal>;
    proposalUpdates: Map<number, ProposalUpdate>;
    proposalsByTitle: Map<string, number>;
    votes: Map<string, boolean>;
  } = {
    nextProposalId: 0,
    maxProposals: 1000,
    proposalFee: 500,
    governanceContract: null,
    proposals: new Map(),
    proposalUpdates: new Map(),
    proposalsByTitle: new Map(),
    votes: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  members: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProposalId: 0,
      maxProposals: 1000,
      proposalFee: 500,
      governanceContract: null,
      proposals: new Map(),
      proposalUpdates: new Map(),
      proposalsByTitle: new Map(),
      votes: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.members = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  setGovernanceContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.governanceContract !== null) {
      return { ok: false, value: false };
    }
    this.state.governanceContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setProposalFee(newFee: number): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: false };
    this.state.proposalFee = newFee;
    return { ok: true, value: true };
  }

  createProposal(
    title: string,
    description: string,
    requestedAmount: number,
    recipient: string,
    duration: number,
    proposalType: string,
    quorum: number,
    threshold: number,
    startTime: number,
    endTime: number,
    fundingGoal: number,
    milestoneCount: number
  ): Result<number> {
    if (this.state.nextProposalId >= this.state.maxProposals) return { ok: false, value: ERR_MAX_PROPOSALS_EXCEEDED };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (requestedAmount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (recipient === this.caller) return { ok: false, value: ERR_INVALID_RECIPIENT };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_DURATION };
    if (!["grant", "education", "arts"].includes(proposalType)) return { ok: false, value: ERR_INVALID_PROPOSAL_TYPE };
    if (quorum <= 0 || quorum > 100) return { ok: false, value: ERR_INVALID_QUORUM };
    if (threshold <= 0 || threshold > 100) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (startTime < this.blockHeight) return { ok: false, value: ERR_INVALID_START_TIME };
    if (endTime <= startTime) return { ok: false, value: ERR_INVALID_END_TIME };
    if (fundingGoal <= 0) return { ok: false, value: ERR_INVALID_FUNDING_GOAL };
    if (milestoneCount > 10) return { ok: false, value: ERR_INVALID_MILESTONE };
    if (this.state.proposalsByTitle.has(title)) return { ok: false, value: ERR_PROPOSAL_ALREADY_EXISTS };
    if (!this.state.governanceContract) return { ok: false, value: ERR_NOT_AUTHORIZED };

    this.stxTransfers.push({ amount: this.state.proposalFee, from: this.caller, to: this.state.governanceContract });

    const id = this.state.nextProposalId;
    const proposal: Proposal = {
      title,
      description,
      requestedAmount,
      recipient,
      duration,
      startTime,
      endTime,
      status: "pending",
      proposer: this.caller,
      proposalType,
      quorum,
      threshold,
      votesFor: 0,
      votesAgainst: 0,
      fundingGoal,
      milestoneCount,
      reportSubmitted: false,
    };
    this.state.proposals.set(id, proposal);
    this.state.proposalsByTitle.set(title, id);
    this.state.nextProposalId++;
    return { ok: true, value: id };
  }

  getProposal(id: number): Proposal | null {
    return this.state.proposals.get(id) || null;
  }

  updateProposal(id: number, updateTitle: string, updateDescription: string, updateAmount: number): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.proposer !== this.caller) return { ok: false, value: false };
    if (proposal.status !== "pending") return { ok: false, value: false };
    if (!updateTitle || updateTitle.length > 100) return { ok: false, value: false };
    if (!updateDescription || updateDescription.length > 500) return { ok: false, value: false };
    if (updateAmount <= 0) return { ok: false, value: false };
    if (this.state.proposalsByTitle.has(updateTitle) && this.state.proposalsByTitle.get(updateTitle) !== id) {
      return { ok: false, value: false };
    }

    const updated: Proposal = {
      ...proposal,
      title: updateTitle,
      description: updateDescription,
      requestedAmount: updateAmount,
      startTime: this.blockHeight,
    };
    this.state.proposals.set(id, updated);
    this.state.proposalsByTitle.delete(proposal.title);
    this.state.proposalsByTitle.set(updateTitle, id);
    this.state.proposalUpdates.set(id, {
      updateTitle,
      updateDescription,
      updateAmount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  startVoting(id: number): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.proposer !== this.caller) return { ok: false, value: false };
    if (proposal.status !== "pending") return { ok: false, value: false };
    if (this.blockHeight < proposal.startTime) return { ok: false, value: false };
    this.state.proposals.set(id, { ...proposal, status: "active" });
    return { ok: true, value: true };
  }

  voteOnProposal(id: number, vote: boolean): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.status !== "active") return { ok: false, value: false };
    if (this.blockHeight >= proposal.endTime) return { ok: false, value: false };
    const voteKey = `${id}-${this.caller}`;
    if (this.state.votes.has(voteKey)) return { ok: false, value: false };
    this.state.votes.set(voteKey, vote);
    if (vote) {
      this.state.proposals.set(id, { ...proposal, votesFor: proposal.votesFor + 1 });
    } else {
      this.state.proposals.set(id, { ...proposal, votesAgainst: proposal.votesAgainst + 1 });
    }
    return { ok: true, value: true };
  }

  finalizeProposal(id: number): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.status !== "active") return { ok: false, value: false };
    if (this.blockHeight < proposal.endTime) return { ok: false, value: false };
    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    const quorumMet = totalVotes >= proposal.quorum;
    const thresholdMet = proposal.votesFor >= proposal.threshold;
    if (quorumMet && thresholdMet) {
      this.state.proposals.set(id, { ...proposal, status: "approved" });
    } else {
      this.state.proposals.set(id, { ...proposal, status: "rejected" });
    }
    return { ok: true, value: true };
  }

  submitReport(id: number, reportSubmitted: boolean): Result<boolean> {
    const proposal = this.state.proposals.get(id);
    if (!proposal) return { ok: false, value: false };
    if (proposal.recipient !== this.caller) return { ok: false, value: false };
    if (proposal.status !== "approved") return { ok: false, value: false };
    this.state.proposals.set(id, { ...proposal, reportSubmitted });
    return { ok: true, value: true };
  }

  getProposalCount(): Result<number> {
    return { ok: true, value: this.state.nextProposalId };
  }

  checkProposalExistence(title: string): Result<boolean> {
    return { ok: true, value: this.state.proposalsByTitle.has(title) };
  }
}

describe("ProposalContract", () => {
  let contract: ProposalContractMock;

  beforeEach(() => {
    contract = new ProposalContractMock();
    contract.reset();
  });

  it("creates a proposal successfully", () => {
    contract.setGovernanceContract("ST2TEST");
    const result = contract.createProposal(
      "Art Grant",
      "Fund arts in schools",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const proposal = contract.getProposal(0);
    expect(proposal?.title).toBe("Art Grant");
    expect(proposal?.description).toBe("Fund arts in schools");
    expect(proposal?.requestedAmount).toBe(1000);
    expect(proposal?.recipient).toBe("ST3RECIP");
    expect(proposal?.duration).toBe(30);
    expect(proposal?.proposalType).toBe("grant");
    expect(proposal?.quorum).toBe(50);
    expect(proposal?.threshold).toBe(60);
    expect(proposal?.startTime).toBe(10);
    expect(proposal?.endTime).toBe(40);
    expect(proposal?.fundingGoal).toBe(5000);
    expect(proposal?.milestoneCount).toBe(3);
    expect(proposal?.status).toBe("pending");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate proposal titles", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Art Grant",
      "Fund arts in schools",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    const result = contract.createProposal(
      "Art Grant",
      "Another description",
      2000,
      "ST4RECIP",
      60,
      "education",
      60,
      70,
      20,
      80,
      10000,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROPOSAL_ALREADY_EXISTS);
  });

  it("rejects proposal creation without governance contract", () => {
    const result = contract.createProposal(
      "NoGov",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects invalid title", () => {
    contract.setGovernanceContract("ST2TEST");
    const result = contract.createProposal(
      "",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("updates a proposal successfully", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Old Title",
      "Old Desc",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    const result = contract.updateProposal(0, "New Title", "New Desc", 2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.title).toBe("New Title");
    expect(proposal?.description).toBe("New Desc");
    expect(proposal?.requestedAmount).toBe(2000);
    const update = contract.state.proposalUpdates.get(0);
    expect(update?.updateTitle).toBe("New Title");
    expect(update?.updateDescription).toBe("New Desc");
    expect(update?.updateAmount).toBe(2000);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent proposal", () => {
    contract.setGovernanceContract("ST2TEST");
    const result = contract.updateProposal(99, "New Title", "New Desc", 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-proposer", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      10,
      40,
      5000,
      3
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateProposal(0, "New Title", "New Desc", 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("starts voting successfully", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    contract.blockHeight = 5;
    const result = contract.startVoting(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.status).toBe("active");
  });

  it("casts vote successfully", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    contract.startVoting(0);
    contract.blockHeight = 5;
    const result = contract.voteOnProposal(0, true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.votesFor).toBe(1);
  });

  it("rejects vote after end time", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    contract.startVoting(0);
    contract.blockHeight = 15;
    const result = contract.voteOnProposal(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("finalizes proposal successfully", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      2,
      2,
      0,
      10,
      5000,
      3
    );
    contract.startVoting(0);
    contract.voteOnProposal(0, true);
    contract.caller = "ST4VOTER";
    contract.voteOnProposal(0, true);
    contract.blockHeight = 15;
    const result = contract.finalizeProposal(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const proposal = contract.getProposal(0);
    expect(proposal?.status).toBe("approved");
  });

  it("rejects report submission by non-recipient", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    contract.startVoting(0);
    contract.blockHeight = 15;
    contract.finalizeProposal(0);
    const result = contract.submitReport(0, true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct proposal count", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Proposal1",
      "Desc1",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    contract.createProposal(
      "Proposal2",
      "Desc2",
      2000,
      "ST4RECIP",
      60,
      "education",
      60,
      70,
      5,
      20,
      10000,
      5
    );
    const result = contract.getProposalCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks proposal existence correctly", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.createProposal(
      "Test Proposal",
      "Description",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    const result = contract.checkProposalExistence("Test Proposal");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProposalExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects proposal creation with max proposals exceeded", () => {
    contract.setGovernanceContract("ST2TEST");
    contract.state.maxProposals = 1;
    contract.createProposal(
      "Proposal1",
      "Desc1",
      1000,
      "ST3RECIP",
      30,
      "grant",
      50,
      60,
      0,
      10,
      5000,
      3
    );
    const result = contract.createProposal(
      "Proposal2",
      "Desc2",
      2000,
      "ST4RECIP",
      60,
      "education",
      60,
      70,
      5,
      20,
      10000,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PROPOSALS_EXCEEDED);
  });

  it("sets governance contract successfully", () => {
    const result = contract.setGovernanceContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.governanceContract).toBe("ST2TEST");
  });

  it("rejects invalid governance contract", () => {
    const result = contract.setGovernanceContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});