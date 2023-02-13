let processList = document.getElementById("processes-list");
let currentProcess = document.getElementById("current-process-info");
let activeProcessesElem = document.getElementById("active-processes");
let activeMemory = document.getElementById("active-memory");
let memoryState = document.getElementById("state");
let cycleCountElem = document.getElementById("cycle-count");
let cycleCount = parseInt(cycleCountElem.innerHTML);

// List of all process elements
let processes = [];

// List of active processes (loaded into memory)
let activeProcesses = [];

// List of waiting processes
let waitingProcesses = [];

// List of current processes
let currentProcessWindow = [];

// List of all memory blocks
let memoryBlocks = [];


let runSimBtn = document.getElementById("run-sim-btn");
let simRunning = false;
let stopSim = false;

const animationDelay = 1000;

let blockColors = [
    "#A0332F",
    "#CB7B42",
    "#DCBF53",
    "#93A864",
    "#5E89A8",
    "#524A66",
    "#679186",
    "#264e70",
    "#9ab5c1",
    "#3c9099"
];

function addProcess(process) {
    processList.appendChild(process);
}

// param: Process element
function queueProcess(process) {
    activeProcessesElem.appendChild(process);
}

// Place process into memory block
function allocate(process, memoryBlock, compaction=false) {
    console.log("Loading", process.pid, "into",  memoryBlock.memId);

    memoryBlock.element.style.border = "3px solid green";

    // Create process block element to be loaded into this memory block
    process.block.style.height = (process.size/memoryBlock.size) * 100 + "%";
    let memBlockElem = document.getElementById(memoryBlock.memId);
    if (!compaction) {
        memBlockElem.innerHTML = "";

        // Display remaining memory after allocation
        let remaining = document.createElement("span");
        remaining.classList.add("label");
        remaining.innerHTML = "Block: " + memoryBlock.memId.split("-")[1] + ": "
            + freeSpace(memoryBlock) + "kB fragmented";

        // Resize or hide block label depending on size of remaining space 
        if (((process.size/memoryBlock.size)*100) > 85) {
            remaining.style.fontSize = "0.75em";
            if (((process.size/memoryBlock.size)*100) > 95) {
                remaining.style.opacity = 0;
            }
        }

        memBlockElem.append(remaining);
        currentProcessWindow.push([process, memoryBlock]);
    }

    memBlockElem.style.justifyContent = "start";
    memBlockElem.append(process.block);

    memoryBlock.processes.push(process);
    activeProcesses.push(process);

    // Remove from queued processes window
    process.element.remove();
}

function killProcess(process) {
    process.element.remove(); // Remove from Active process list
    process.block.remove(); // Remove from memory block
    activeProcesses = activeProcesses.filter((proc) => proc.pid !== process.pid);
}

// Load process into memory block via algorithms (First fit, Best fit, Worst fit)
function loadProcess(process) {

    const algorithms = document.getElementById("algorithms");
    const selectedAlgo = algorithms.options[algorithms.selectedIndex].value;

    const algos = {
        "first-fit": firstFit,
        "best-fit": bestFit,
        "worst-fit": worstFit
    };

    algos[selectedAlgo](process);
}

function firstFit(process) {
    memoryState.classList.remove("inactive");
    let isAllocated = false;
    process.element.style = "color: green; font-weight: 700";

    // Iterate memory blocks
    memoryBlocks.some((memoryBlock) => {
        if (memoryBlock.processes.length > 0) { // Block is occupied
            process.element.style = "color: red;";
        } else {
            if (process.size <= memoryBlock.size) {// process fits into memory block
                allocate(process, memoryBlock);
                isAllocated = true;
                return true; // Exit memory block loop; load next process
            }
        } 

        memoryBlock.element.style.border = "1px solid black";
        loadCurrentProcessState();
    });
    // END iterate memory blocks
    
    if (!isAllocated) {
        console.log(process.pid, "is waiting");
        waitingProcesses.push(process);
    }
}

function bestFit(process) {
    if (typeof process !== "undefined") { process.element.style = "color: green; font-weight: 700"; }

    let isAllocated = false;
    let leastRemaining = 99999;
    let bestFitBlock = memoryBlocks[0];

    // Iterate memory blocks
    memoryBlocks.forEach((memoryBlock) => {

        if (memoryBlock.processes.length > 0) {
            process.element.style = "color: red;";
            if (memoryBlock.processes[0].life <= 0) {
                memoryBlock.processes = [];
                cleanupMemory(memoryBlock);
            }
        } else {
            let remaining = memoryBlock.size - process.size;
            if (remaining >= 0
                && remaining < leastRemaining) {
                leastRemaining = remaining;
                bestFitBlock = memoryBlock;
            }
            loadCurrentProcessState();
        }
        memoryBlock.element.style.border = "1px solid black";
    });
    // END iterate memory blocks

    if (leastRemaining < 99999) {
        allocate(process, bestFitBlock);
        isAllocated = true;
    }

    if (!isAllocated) {
        console.log(process.pid, "is waiting");
        waitingProcesses.push(process);
    }
}

function worstFit(process) {
    process.element.style = "color: green; font-weight: 700";

    let mostRemaining = -1;
    let worstFitBlock = memoryBlocks[0];
    let isAllocated = false;

    // Iterate memory blocks
    memoryBlocks.forEach((memoryBlock) => {

        if (memoryBlock.processes.length > 0) {
            process.element.style = "color: red;";
            if (memoryBlock.processes[0].life <= 0) {
                memoryBlock.processes = [];
                cleanupMemory(memoryBlock);
            }
        } else {
            let remaining = memoryBlock.size - process.size;
            if (remaining >= 0
                && remaining > mostRemaining) {
                mostRemaining = remaining;
                worstFitBlock = memoryBlock;
            }
            loadCurrentProcessState();
        }
        memoryBlock.element.style.border = "1px solid black";
    });
    // END iterate memory blocks

    if (mostRemaining > -1) {
        allocate(process, worstFitBlock);
        isAllocated = true;
    }

    if (!isAllocated) {
        console.log(process.pid, "is waiting");
        waitingProcesses.push(process);
    }
}

function loadCurrentProcessState() {
    currentProcess.innerHTML = Object.keys(activeProcesses).length === 0 && cycleCount === 0
        ? "<div>Click run to start</div>"
        : "";
    for (let entry in currentProcessWindow) {
        let process = currentProcessWindow[entry][0];
        let memoryBlock = currentProcessWindow[entry][1];
        let procedure = document.createElement("div");
        procedure.setAttribute("id", "c" + process.pid);
        procedure.innerHTML = "Job: " + process.pid.split("-")[1]
            + " - Block: " + memoryBlock.memId.split("-")[1]
            + " Cycles: " + process.life;
        if (process.life <= 0) {
            procedure.style = "text-decoration: line-through; opacity: 0.5; color: green;";
        }
        currentProcess.append(procedure);
    }

    if (activeProcesses.length === 0 && waitingProcesses.length === 0 && cycleCount > 1) { 
        let state = document.createElement("div");
        state.innerHTML = "<div style=\"font-weight: 700; text-align: center; color: green;\">All processes completed!</div>";
        currentProcess.append(state);
    }
}

function runSim() {
    
    if (simRunning) { stopSim = true;}
    else { stopSim = false; }

    if (cycleCount > 0) {
        console.log("Starting simulation");
        simRunning = true;
        const framerate = animationDelay;
        const interval = setInterval(() => {
            frame();
            if ((processes.length === 0
                && activeProcesses.length === 0
                && waitingProcesses.length === 0)
                || stopSim) {
                console.log("Stopping simulation");
                clearInterval(interval);
                runSimBtn.innerHTML =  "<i class=\"fas fa-play\"></i> Run";
                simRunning = false;
            }
        }, framerate);
    }
  
    if (cycleCount === 0) {
        currentProcess.innerHTML = "";

        // Queue processes
        processes.forEach((process) => {
            queueProcess(process.element);
        });
    }

    runSimBtn.innerHTML = simRunning ? "<i class=\"fas fa-pause\"></i> Stop" : "<i class=\"fas fa-play\"></i> Run";
}

function frame() {

    if (processes.length === 0
        && activeProcesses.length === 0
        && waitingProcesses.length === 0) { return; }

    activeProcesses.forEach((process) => { process.life -= 1; });

    // Process waiting first
    if (waitingProcesses.length > 0) {
        let waitingProcess = waitingProcesses.shift();
        console.log("Loading waiting process:", waitingProcess);
        if (isLive(waitingProcess)) {
            loadProcess(waitingProcess)
        }
    } else { // Load process unless already active
        let process = processes.shift();
        console.log("Loading process:", process);
        if (isLive(process)) {
            loadProcess(process);
        }
    }

    // Clean up finished processes
    activeProcesses.forEach((process) => {
        if (typeof(process) !== 'undefined' && process.life <= 0) {
            console.log("Killing ", process);
            killProcess(process);
        }
    });

    // Clean up processes in memory
    memoryBlocks.forEach((memoryBlock) => {
        if (memoryBlock.processes.length <= 0 || activeProcesses.length === 0) {
            console.log("cleaning", memoryBlock);
            cleanupMemory(memoryBlock);
        }

        if (memoryBlock.processes.length > 0 && memoryBlock.processes[0].life <= 0) {
            cleanupMemory(memoryBlock);
        }
    });

    incrementCycleCount();
    updateUI();
}

function updateUI() {
    if (processes.length === 0) {
        processList.innerHTML = "";
        let placeholder = document.createElement("div");
        placeholder.innerHTML = "<div>No processes...</div>";
        processList.append(placeholder);
        runSimBtn.disabled = true;
    } else {
        runSimBtn.disabled = false;
    }
    loadCurrentProcessState();
}

function createMemoryBlocks() {

    const el = document.getElementById("total-memory-size");
    const e = document.getElementById("num-of-blocks");
    const totalMem = parseInt(el.options[el.selectedIndex].value);
    const numOfBlocks = parseInt(e.options[e.selectedIndex].value);

    for (let i = 0; i < numOfBlocks; i++) {
        const memSoFar = Object.keys(memoryBlocks).map((k) => { return memoryBlocks[k].size; })
        const blockSize = (i === numOfBlocks - 1) // Last block fills remaining memory
            ? totalMem - memSoFar.reduce((t, c) => { return t + c; })
            : Math.round((totalMem/numOfBlocks) + getRandomInRange(-20, 20));
        const memId = "memAddr-" + (i+1);
        const blockEl = document.createElement("div");
        blockEl.setAttribute("id", memId);
        blockEl.className = "memory-block memory-block--unallocated";
        blockEl.innerHTML = "<span class=\"label\">Block " + (i+1) + " unallocated - " + blockSize + "kB</span>";
        blockEl.style.height = Math.round((blockSize/totalMem) * 100) - 1 + "%";
        activeMemory.append(blockEl);

        let memoryBlock = {
            "memId": memId,
            "size": blockSize,
            "processes": [],
            "element": blockEl
        }

        memoryBlocks.push(memoryBlock);
    }
}

function createProcesses() {
    reset();
    let numOfProcesses = document.getElementById("number-of-processes").value;
    numOfProcesses = isNaN(numOfProcesses) ? 1 : parseInt(numOfProcesses);
    const processForms = document.getElementById("process-forms-container");

    for (let i = 0; i < numOfProcesses; i++) {
        const processForm = processForms.children[i];
        const pid = "pid-" + processForm.getAttribute("id").slice(-1);
        const procSize = parseInt(processForm.children[1].children[1].value);
        const procCycles = parseInt(processForm.children[2].children[1].value);

        // List element
        const processElem = document.createElement("div");
        processElem.setAttribute("id", pid);
        processElem.innerHTML = "Job: " + (i+1) + " - " + procSize + "kB - " + procCycles + " cycles";

        // Memory Element
        const processEl = document.createElement("div");
        processEl.setAttribute("id", "mem-" + pid);
        processEl.className = "memory-block memory-block--process";
        processEl.innerHTML = "<span class=\"label\">" + processElem.innerHTML + "</span>";
        processEl.style.backgroundColor = blockColors[Math.floor(Math.random()*blockColors.length)];

        // Add process to queue
        addProcess(processElem);

        let process = {
            "pid": pid,
            "size": procSize,
            "life": procCycles, // Number of cycles needed to complete
            "element": processElem, // Process list element in queues
            "block": processEl // Process block element in active memory
        }
        processes.push(process);
    }

    closeModal();
    updateUI();
}

function createRandomProcesses() {
    processList.innerHTML = "";
    const el = document.getElementById("total-memory-size");
    const e = document.getElementById("num-of-blocks");
    const totalMem = parseInt(el.options[el.selectedIndex].value);
    const numOfBlocks = parseInt(e.options[e.selectedIndex].value);
    const processCount = processes.length;
    const numOfProcesses = parseInt(document.getElementById("number-of-processes").value);

    // Load existing processes
    processes.forEach((process) => {
        processList.append(process.element);
    });

    for (let i = processCount; i < processCount + numOfProcesses; i++) {
        const pid = "pid-" + (i+1);
        const procSize = Math.round(getRandomInRange(50, (totalMem/numOfBlocks) - 10));
        const life = Math.round(getRandomInRange(4, 10)); // Number of cycles needed to complete

        // List element
        const processElem = document.createElement("div");
        processElem.setAttribute("id", pid);
        processElem.innerHTML = "Job: " + (i+1) + " - " + procSize + "kB - " + life + " cycles";

        // Memory Element
        const processEl = document.createElement("div");
        processEl.setAttribute("id", "mem-" + pid);
        processEl.className = "memory-block memory-block--process";
        processEl.innerHTML = "<span class=\"label\">" + processElem.innerHTML + "</span>";
        processEl.style.backgroundColor = blockColors[Math.floor(Math.random()*blockColors.length)];
        
        // Add process to queue
        addProcess(processElem);

        let process = {
            "pid": pid,
            "size": procSize,
            "life": life, // Number of cycles needed to complete
            "element": processElem, // Process list element in queues
            "block": processEl // Process block element in active memory
        }
        processes.push(process);
    }
    
    closeModal();
    updateUI();
}

function compaction() {

    for (let i = 0; i < memoryBlocks.length; i++) {
        const memoryBlock = memoryBlocks[i];
        cleanupMemory(memoryBlock);
    }

    const done = [];

    let pIndex = 0;
    for (let i = 0; i < memoryBlocks.length; i++) {
        const memoryBlock = memoryBlocks[i];
        while (pIndex < activeProcesses.length) {
            if (freeSpace(memoryBlock) >= activeProcesses[pIndex].size
                    && !done.includes(activeProcesses[pIndex].pid)) {
                allocate(activeProcesses[pIndex], memoryBlock, true);
                done.push(activeProcesses[pIndex].pid);
            }
            pIndex += 1;
        }
    }
}

function coalesce() {
    for (let i = 0; i < memoryBlocks.length-1; i++) {
        if (isEmpty(memoryBlocks[i]) && isEmpty(memoryBlocks[i+1])) {
            mergeBlocks(memoryBlocks[i],  memoryBlocks[i+1]);
        }
    }
}

function mergeBlocks(block1, block2) {
    console.log("merging ", block1.memId, block2.memId);

    const el = document.getElementById("total-memory-size");
    const totalMem = parseInt(el.options[el.selectedIndex].value);

    block1.size = block1.size + block2.size;
    console.log("adding", block1.size, block2.size, block1.size + block2.size);

    block1.element.innerHTML = "<span class=\"label\">Block " + block1.memId.split("-")[1]
        +" unallocated - " + block1.size + "kB</span>";
    block1.element.style.height = Math.round((block1.size/totalMem) * 100) - 1 + "%";

    activeMemory.removeChild(block2.element);

    memoryBlocks = memoryBlocks.filter((block) => block.memId !== block2.memId);
}

function freeSpace(memoryBlock) {
    if (memoryBlock.processes.length === 0) { return memoryBlock.size; }
    const memUsed = memoryBlock.processes.map((p) => { return p.size; })
    return memoryBlock.size - memUsed.reduce((t, c) => { return t + c; });
}

function getOwningBlock(process) {
    for (let i = 0; i < memoryBlocks.length; i++) {
        for (let j = 0; j < memoryBlocks[i].processes.length; j++) {
            if (memoryBlocks[i].processes[j].pid === process.pid) {
                return memoryBlocks[i];
            }
        }
    }

    return null;
}

function isProcessInBlock(process, block) {
    for (let i = 0; i < block.processes.length; i++) {
        if (process.pid === block.processes[i].pid) {
            console.log(process.pid, "found in", block.memId);
            return true;
        }
    }
    return false;
}

function cleanupMemory(memoryBlock) {
    memoryBlock.processes = [];
    memoryBlock.element.innerHTML = "";
    memoryBlock.element.style.justifyContent = "center";
    memoryBlock.element.style.border = "none";
    let unallocated = document.createElement("span");
    unallocated.innerHTML = "<span class=\"label\">Block " + memoryBlock.memId.split("-")[1]
        + " unallocated - " + memoryBlock.size + "kB</span>";
    memoryBlock.element.append(unallocated);
}

function reset() {
    activeMemory.innerHTML = "";
    activeProcessesElem.innerHTML = "";
    cycleCountElem.innerHTML = 0;
    cycleCount = 0;
    processList.innerHTML = "";
    currentProcess.innerHTML = "<div class=\"state-indicator\">Not running...</div>";
    memoryState.innerHTML = "<div class=\"state-indicator\">Not running...</div>";
    memoryBlocks = [];
    processes = [];
    activeProcesses = [];
    waitingProcesses = [];
    currentProcessWindow = [];
    stopSim = false;
    simRunning = false;
    createMemoryBlocks();
}

function incrementCycleCount() {
    cycleCount += 1;
    cycleCountElem.innerHTML = cycleCount;
}

function isActive(process) {
    if (typeof process === "undefined") { return false; }
    for (let proc in activeProcesses) {
        if (activeProcesses[proc].pid === process.pid) {
            return true;
        }
    }
    return false;
}

function isEmpty(memoryBlock) {
    return memoryBlock.processes.length === 0;
}

function isLive(process) {
    return (typeof process !== "undefined" && !isActive(process) && process.life > 0);
}

function getRandomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function openModal() {
    const modal = document.getElementById("create-processes-modal");
    modal.style.display = "flex";
    createProcessesForm();
}

function closeModal() {
    const modal = document.getElementById("create-processes-modal");
    modal.style.display = "none";
}

function validate(element) {
    if (isNaN(element.value)) { element.value = element.value.slice(0, -1); }
    if (element.attributes["id"].value === "number-of-processes") { createProcessesForm(); }
}

function createProcessesForm() {
    const formContainer = document.getElementById("process-forms-container");
    const firstChild = formContainer.children[0].cloneNode(true);
    (firstChild.children.length > 2) ? firstChild.removeChild(firstChild.firstChild) : "";
    formContainer.innerHTML = "";
    formContainer.appendChild(firstChild);

    const n = document.getElementById("number-of-processes").value;
    const numberOfProcesses = isNaN(n) ? 1 : parseInt(n);

    for (let i = 1; i < numberOfProcesses; i++) {
        const processForm = document.getElementById("fid-1").cloneNode(true);
        processForm.setAttribute("id", "fid-" + (i+1));
        const jobLabel = document.createElement("div");
        jobLabel.classList.add("process-label");
        jobLabel.innerHTML = "Job " + (i+1);
        processForm.prepend(jobLabel);
        formContainer.append(processForm);
    }

    // First process form
    const processForm = document.getElementById("fid-1");
    const jobLabel = document.createElement("div");
    jobLabel.classList.add("process-label");
    jobLabel.innerHTML = "Job 1"; 
    processForm.prepend(jobLabel);
}

reset();
