(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-TITLE u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-RECIPIENT u104)
(define-constant ERR-INVALID-DURATION u105)
(define-constant ERR-PROPOSAL-ALREADY-EXISTS u106)
(define-constant ERR-PROPOSAL-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-NOT-MEMBER u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-VOTING-NOT-STARTED u111)
(define-constant ERR-VOTING-ALREADY-ENDED u112)
(define-constant ERR-ALREADY-VOTED u113)
(define-constant ERR-INVALID-VOTE u114)
(define-constant ERR-INSUFFICIENT-BALANCE u115)
(define-constant ERR-PROPOSAL-EXPIRED u116)
(define-constant ERR-INVALID-UPDATE-PARAM u117)
(define-constant ERR-MAX-PROPOSALS-EXCEEDED u118)
(define-constant ERR-INVALID-PROPOSAL-TYPE u119)
(define-constant ERR-INVALID-START-TIME u120)
(define-constant ERR-INVALID-END-TIME u121)
(define-constant ERR-INVALID-QUORUM u122)
(define-constant ERR-INVALID-THRESHOLD u123)
(define-constant ERR-PROPOSAL-NOT-ACTIVE u124)
(define-constant ERR-PROPOSAL-ALREADY-APPROVED u125)
(define-constant ERR-PROPOSAL-ALREADY-REJECTED u126)
(define-constant ERR-INVALID-MEMBER-COUNT u127)
(define-constant ERR-INVALID-FUNDING-GOAL u128)
(define-constant ERR-INVALID-MILESTONE u129)
(define-constant ERR-INVALID-REPORT u130)

(define-data-var next-proposal-id uint u0)
(define-data-var max-proposals uint u1000)
(define-data-var proposal-fee uint u500)
(define-data-var governance-contract (optional principal) none)

(define-map proposals
  uint
  {
    title: (string-utf8 100),
    description: (string-utf8 500),
    requested-amount: uint,
    recipient: principal,
    duration: uint,
    start-time: uint,
    end-time: uint,
    status: (string-ascii 20),
    proposer: principal,
    proposal-type: (string-ascii 50),
    quorum: uint,
    threshold: uint,
    votes-for: uint,
    votes-against: uint,
    funding-goal: uint,
    milestone-count: uint,
    report-submitted: bool
  }
)

(define-map proposals-by-title
  (string-utf8 100)
  uint)

(define-map proposal-updates
  uint
  {
    update-title: (string-utf8 100),
    update-description: (string-utf8 500),
    update-amount: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-map votes
  { proposal-id: uint, voter: principal }
  bool)

(define-read-only (get-proposal (id uint))
  (map-get? proposals id)
)

(define-read-only (get-proposal-updates (id uint))
  (map-get? proposal-updates id)
)

(define-read-only (is-proposal-registered (title (string-utf8 100)))
  (is-some (map-get? proposals-by-title title))
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-receipt (recipient principal))
  (if (not (is-eq recipient tx-sender))
      (ok true)
      (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-duration (duration uint))
  (if (> duration u0)
      (ok true)
      (err ERR-INVALID-DURATION))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-proposal-type (ptype (string-ascii 50)))
  (if (or (is-eq ptype "grant") (is-eq ptype "education") (is-eq ptype "arts"))
      (ok true)
      (err ERR-INVALID-PROPOSAL-TYPE))
)

(define-private (validate-quorum (quorum uint))
  (if (and (> quorum u0) (<= quorum u100))
      (ok true)
      (err ERR-INVALID-QUORUM))
)

(define-private (validate-threshold (threshold uint))
  (if (and (> threshold u0) (<= threshold u100))
      (ok true)
      (err ERR-INVALID-THRESHOLD))
)

(define-private (validate-start-time (stime uint))
  (if (>= stime block-height)
      (ok true)
      (err ERR-INVALID-START-TIME))
)

(define-private (validate-end-time (etime uint) (stime uint))
  (if (> etime stime)
      (ok true)
      (err ERR-INVALID-END-TIME))
)

(define-private (validate-funding-goal (goal uint))
  (if (> goal u0)
      (ok true)
      (err ERR-INVALID-FUNDING-GOAL))
)

(define-private (validate-milestone-count (count uint))
  (if (<= count u10)
      (ok true)
      (err ERR-INVALID-MILESTONE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-governance-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get governance-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set governance-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-proposals (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX_PROPOSALS-EXCEEDED))
    (asserts! (is-some (var-get governance-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set max-proposals new-max)
    (ok true)
  )
)

(define-public (set-proposal-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get governance-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set proposal-fee new-fee)
    (ok true)
  )
)

(define-public (create-proposal
  (title (string-utf8 100))
  (description (string-utf8 500))
  (requested-amount uint)
  (recipient principal)
  (duration uint)
  (proposal-type (string-ascii 50))
  (quorum uint)
  (threshold uint)
  (start-time uint)
  (end-time uint)
  (funding-goal uint)
  (milestone-count uint)
)
  (let (
        (next-id (var-get next-proposal-id))
        (current-max (var-get max-proposals))
        (governance (var-get governance-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX_PROPOSALS-EXCEEDED))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-amount requested-amount))
    (try! (validate-receipt recipient))
    (try! (validate-duration duration))
    (try! (validate-proposal-type proposal-type))
    (try! (validate-quorum quorum))
    (try! (validate-threshold threshold))
    (try! (validate-start-time start-time))
    (try! (validate-end-time end-time start-time))
    (try! (validate-funding-goal funding-goal))
    (try! (validate-milestone-count milestone-count))
    (asserts! (is-none (map-get? proposals-by-title title)) (err ERR-PROPOSAL-ALREADY-EXISTS))
    (let ((governance-recipient (unwrap! governance (err ERR-NOT-AUTHORIZED))))
      (try! (stx-transfer? (var-get proposal-fee) tx-sender governance-recipient))
    )
    (map-set proposals next-id
      {
        title: title,
        description: description,
        requested-amount: requested-amount,
        recipient: recipient,
        duration: duration,
        start-time: start-time,
        end-time: end-time,
        status: "pending",
        proposer: tx-sender,
        proposal-type: proposal-type,
        quorum: quorum,
        threshold: threshold,
        votes-for: u0,
        votes-against: u0,
        funding-goal: funding-goal,
        milestone-count: milestone-count,
        report-submitted: false
      }
    )
    (map-set proposals-by-title title next-id)
    (var-set next-proposal-id (+ next-id u1))
    (print { event: "proposal-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-proposal
  (proposal-id uint)
  (update-title (string-utf8 100))
  (update-description (string-utf8 500))
  (update-amount uint)
)
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get proposer p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status p) "pending") (err ERR-PROPOSAL_NOT_ACTIVE))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (try! (validate-amount update-amount))
          (let ((existing (map-get? proposals-by-title update-title)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id proposal-id) (err ERR-PROPOSAL-ALREADY-EXISTS))
              (begin true)
            )
          )
          (let ((old-title (get title p)))
            (if (is-eq old-title update-title)
                (ok true)
                (begin
                  (map-delete proposals-by-title old-title)
                  (map-set proposals-by-title update-title proposal-id)
                  (ok true)
                )
            )
          )
          (map-set proposals proposal-id
            (merge p {
              title: update-title,
              description: update-description,
              requested-amount: update-amount,
              start-time: block-height
            })
          )
          (map-set proposal-updates proposal-id
            {
              update-title: update-title,
              update-description: update-description,
              update-amount: update-amount,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "proposal-updated", id: proposal-id })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (start-voting (proposal-id uint))
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get proposer p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status p) "pending") (err ERR_VOTING-NOT-STARTED))
          (asserts! (>= block-height (get start-time p)) (err ERR-INVALID-TIMESTAMP))
          (map-set proposals proposal-id
            (merge p { status: "active" })
          )
          (print { event: "voting-started", id: proposal-id })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (vote-on-proposal (proposal-id uint) (vote bool))
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get status p) "active") (err ERR_PROPOSAL_NOT_ACTIVE))
          (asserts! (< block-height (get end-time p)) (err ERR_VOTING-ALREADY-ENDED))
          (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) (err ERR_ALREADY_VOTED))
          (map-set votes { proposal-id: proposal-id, voter: tx-sender } vote)
          (if vote
              (map-set proposals proposal-id
                (merge p { votes-for: (+ (get votes-for p) u1) })
              )
              (map-set proposals proposal-id
                (merge p { votes-against: (+ (get votes-against p) u1) })
              )
          )
          (print { event: "vote-cast", id: proposal-id, voter: tx-sender, vote: vote })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (finalize-proposal (proposal-id uint))
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get status p) "active") (err ERR_PROPOSAL_NOT_ACTIVE))
          (asserts! (>= block-height (get end-time p)) (err ERR_VOTING-NOT-STARTED))
          (let (
                (total-votes (+ (get votes-for p) (get votes-against p)))
                (quorum-met (>= total-votes (get quorum p)))
                (threshold-met (>= (get votes-for p) (get threshold p)))
              )
            (if (and quorum-met threshold-met)
                (map-set proposals proposal-id
                  (merge p { status: "approved" })
                )
                (map-set proposals proposal-id
                  (merge p { status: "rejected" })
                )
            )
          )
          (print { event: "proposal-finalized", id: proposal-id })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (submit-report (proposal-id uint) (report-submitted bool))
  (let ((proposal (map-get? proposals proposal-id)))
    (match proposal
      p
        (begin
          (asserts! (is-eq (get recipient p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status p) "approved") (err ERR_PROPOSAL_ALREADY_APPROVED))
          (map-set proposals proposal-id
            (merge p { report-submitted: report-submitted })
          )
          (print { event: "report-submitted", id: proposal-id })
          (ok true)
        )
      (err ERR-PROPOSAL-NOT-FOUND)
    )
  )
)

(define-public (get-proposal-count)
  (ok (var-get next-proposal-id))
)

(define-public (check-proposal-existence (title (string-utf8 100)))
  (ok (is-proposal-registered title))
)