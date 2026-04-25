function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function clearUserSession() {
    localStorage.removeItem("loggedInRole");
    localStorage.removeItem("loggedInUserEmail");
}

function setLoginError(message) {
    localStorage.setItem("loginError", message);
}

function showStoredLoginError() {
    const error = document.getElementById("error");
    const message = localStorage.getItem("loginError");

    if (!error || !message) return;

    error.innerText = message;
    localStorage.removeItem("loginError");
}

function getApprovedStudentByEmail(email) {
    const students = readStorageArray("students");

    return students.find(student =>
        normalizeEmail(student.email) === normalizeEmail(email) &&
        String(student.status || "").trim() === "Approved"
    );
}

function requireApprovedStudentAccess() {
    const role = localStorage.getItem("loggedInRole");
    const email = localStorage.getItem("loggedInUserEmail");

    // Status-based access control: student sessions are only valid for approved students.
    if (role !== "student" || !email) {
        clearUserSession();
        setLoginError("Please login with an approved student account.");
        window.location.href = "index.html";
        return null;
    }

    const students = readStorageArray("students");
    const currentStudent = students.find(student =>
        normalizeEmail(student.email) === normalizeEmail(email)
    );
    const student = getApprovedStudentByEmail(email);

    if (!student) {
        clearUserSession();
        if (currentStudent && currentStudent.status === "Rejected") {
            setLoginError("Your account has been rejected. Contact admin.");
        } else {
            setLoginError("Please login with an approved student account.");
        }
        window.location.href = "index.html";
        return null;
    }

    return student;
}

async function login() {
    await ensureBackendData();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;
    const error = document.getElementById("error");

    // HOD login
    if (role === "hod") {

        if (email === "hod@college.com" && password === "hod123") {
            localStorage.setItem("loggedInRole", "hod");
            localStorage.setItem("loggedInUserEmail", email);
            window.location.href = "hod.html";
        } else {
            error.innerText = "Invalid HOD credentials!";
        }
    }

    // Faculty login (dynamic)
    else if (role === "faculty") {

        const facultyList = JSON.parse(localStorage.getItem("faculty")) || [];

        const faculty = facultyList.find(f => f.email === email);

        if (faculty && password === "123456") {

            localStorage.setItem("loggedInRole", "faculty");
            localStorage.setItem("loggedInUserEmail", email);
            window.location.href = "faculty.html";

        } else {
            error.innerText = "Invalid Faculty credentials!";
        }
    }

    // Student login (simple demo)
    else if (role === "student") {

        const students = JSON.parse(localStorage.getItem("students")) || [];
        const student = students.find(s => normalizeEmail(s.email) === normalizeEmail(email));

        if (student && password === "123456") {
            // Status-based access control: only approved students can create a session.
            if (student.status === "Rejected") {
                error.innerText = "Your account has been rejected. Contact admin.";
                return;
            }

            if (student.status !== "Approved") {
                error.innerText = "Your account is pending approval.";
                return;
            }

            localStorage.setItem("loggedInRole", "student");
            localStorage.setItem("loggedInUserEmail", normalizeEmail(email));
            window.location.href = "student.html";

        } else {
            error.innerText = "Invalid Student credentials!";
        }
    }
}
async function loadDashboard() {
    await ensureBackendData();

    const students = readStorageArray("students");
    const approvedStudents = students.filter(student => student.status === "Approved");
    const faculty = readStorageArray("faculty");
    const classes = readStorageArray("classes");
    const assignments = readStorageArray("assignments");
    const studentCountEl = document.getElementById("studentCount");
    const facultyCountEl = document.getElementById("facultyCount");
    const classCountEl = document.getElementById("classCount");

    if (studentCountEl) studentCountEl.innerText = approvedStudents.length;
    if (facultyCountEl) facultyCountEl.innerText = faculty.length;
    if (classCountEl) classCountEl.innerText = classes.length;

    renderDashboardFacultyList(faculty);
    renderDashboardAssignments(assignments);
    renderDashboardStudentList([]);
    renderDashboardStudentGroups(classes, approvedStudents);
    setDashboardStudentMessage("Select a class above to view students.");
    updateDashboardSelectedClass();
    renderDashboardClassList(classes);
    initializeStaffAttendanceDate();
    loadStaffAttendanceRows();
    loadSavedStaffAttendanceTable();
    showDashboardTab("faculty");
}

function showDashboardTab(tabName) {
    const tabMap = {
        faculty: {
            button: "facultyTabButton",
            section: "facultySection"
        },
        students: {
            button: "studentsTabButton",
            section: "studentsSection"
        },
        classes: {
            button: "classesTabButton",
            section: "classesSection"
        },
        staffAttendance: {
            button: "staffAttendanceTabButton",
            section: "staffAttendanceSection"
        }
    };

    Object.keys(tabMap).forEach(key => {
        const button = document.getElementById(tabMap[key].button);
        const section = document.getElementById(tabMap[key].section);
        const isActive = key === tabName;

        if (button) {
            button.classList.toggle("active", isActive);
        }

        if (section) {
            section.classList.toggle("active", isActive);
        }
    });
}

function renderDashboardFacultyList(faculty) {
    const tableBody = document.getElementById("dashboardFacultyTable");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (faculty.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="2">No faculty records found.</td>
            </tr>
        `;
        return;
    }

    faculty.forEach(member => {
        tableBody.innerHTML += `
            <tr>
                <td>${member.name || "-"}</td>
                <td>${member.email || "-"}</td>
            </tr>
        `;
    });
}

function renderDashboardAssignments(assignments) {
    const tableBody = document.getElementById("dashboardAssignmentTable");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (assignments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4">No subject assignments found.</td>
            </tr>
        `;
        return;
    }

    assignments.forEach(assignment => {
        const assignmentIndex = assignments.indexOf(assignment);

        tableBody.innerHTML += `
            <tr>
                <td>${assignment.facultyName || "-"}</td>
                <td>${assignment.className || "-"}</td>
                <td>${assignment.subjectName || "-"}</td>
                <td>${renderDashboardWeeklyTimetableSelector(assignmentIndex)}</td>
            </tr>
        `;
    });
}

function renderDashboardWeeklyTimetableSelector(assignmentIndex) {

    const assignments = JSON.parse(localStorage.getItem("assignments")) || [];
    const assignment = assignments[assignmentIndex];
    const weeklyTimetable = assignment && Array.isArray(assignment.weeklyTimetable)
        ? assignment.weeklyTimetable
        : [];

    if (weeklyTimetable.length === 0) {
        return "Not added";
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const options = days
        .map(day => `<option value="${day}">${day}</option>`)
        .join("");

    return `
        <select onchange="showDashboardSelectedTimetable(${assignmentIndex}, this.value)">
            <option value="">Show Time Table</option>
            ${options}
        </select>
        <div id="dashboardSelectedTimetable-${assignmentIndex}" class="selected-timetable-output"></div>
    `;
}

function showDashboardSelectedTimetable(assignmentIndex, selectedDay) {

    const output = document.getElementById(`dashboardSelectedTimetable-${assignmentIndex}`);

    if (!output) return;

    if (!selectedDay) {
        output.innerHTML = "";
        return;
    }

    const assignments = JSON.parse(localStorage.getItem("assignments")) || [];
    const assignment = assignments[assignmentIndex];
    const weeklyTimetable = assignment && Array.isArray(assignment.weeklyTimetable)
        ? assignment.weeklyTimetable
        : [];

    const selectedEntry = weeklyTimetable.find(entry => entry.day === selectedDay);

    if (!selectedEntry) {
        output.innerHTML = `
            <div>Selected: ${selectedDay}</div>
            <div>&rarr; Output: Not available</div>
        `;
        return;
    }

    output.innerHTML = `
        <div>Selected: ${selectedDay}</div>
        <div>&rarr; Output: ${selectedEntry.slot}</div>
    `;
}

function renderDashboardStudentList(students) {
    const tableBody = document.getElementById("dashboardStudentTable");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (students.length === 0) {
        return;
    }

    students.forEach(student => {
        tableBody.innerHTML += `
            <tr>
                <td>${student.name || "-"}</td>
                <td>${student.roll || student.roll_no || "-"}</td>
                <td>${student.class || "-"}</td>
            </tr>
        `;
    });
}

function renderDashboardStudentGroups(classes, students) {
    const tableBody = document.getElementById("dashboardStudentGroupTable");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (classes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="2">No classes found.</td>
            </tr>
        `;
        return;
    }

    const classCounts = new Map();

    students.forEach(student => {
        const className = student.class || "Unassigned";
        classCounts.set(className, (classCounts.get(className) || 0) + 1);
    });

    classes.forEach(classRecord => {
        const className = classRecord.className || "Unnamed Class";
        const count = classCounts.get(className) || 0;

        tableBody.innerHTML += `
            <tr class="dashboard-class-row" data-class-id="${classRecord.id}" data-class-name="${escapeHtmlAttribute(className)}" role="button" tabindex="0" onclick="handleDashboardClassSelectionFromRow(this)" onkeydown="handleDashboardClassRowKeydown(event, this)">
                <td>${className}</td>
                <td>${count}</td>
            </tr>
        `;
    });
}

function escapeHtmlAttribute(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function setDashboardStudentMessage(message, isError = false) {
    const messageEl = document.getElementById("dashboardStudentTableMessage");

    if (!messageEl) return;

    messageEl.textContent = message || "";
    messageEl.classList.toggle("text-danger", Boolean(isError));
    messageEl.classList.toggle("text-muted", !isError);
}

function updateDashboardSelectedClass(className = "") {
    const badge = document.getElementById("dashboardSelectedClassBadge");

    if (!badge) return;

    badge.textContent = className ? `Selected: ${className}` : "No class selected";
}

function highlightDashboardSelectedClass(classId) {
    const rows = document.querySelectorAll("#dashboardStudentGroupTable .dashboard-class-row");

    rows.forEach(row => {
        const rowClassId = Number(row.dataset.classId);
        row.classList.toggle("active", rowClassId === Number(classId));
    });
}

function handleDashboardClassSelectionFromRow(row) {
    if (!row) return;

    handleDashboardClassSelection(row.dataset.classId, row.dataset.className || "");
}

function handleDashboardClassRowKeydown(event, row) {
    if (event.key !== "Enter" && event.key !== " ") {
        return;
    }

    event.preventDefault();
    handleDashboardClassSelectionFromRow(row);
}

async function handleDashboardClassSelection(classId, className) {
    const tableBody = document.getElementById("dashboardStudentTable");

    if (!tableBody) return;

    renderDashboardStudentList([]);
    setDashboardStudentMessage("Loading students...");
    highlightDashboardSelectedClass(classId);
    updateDashboardSelectedClass(className);

    try {
        const response = await window.erpApi.students.byClass(classId);
        const students = Array.isArray(response.students)
            ? response.students.map(student => ({
                ...student,
                class: student.class_name || className || "-"
            }))
            : [];

        renderDashboardStudentList(students);

        if (students.length === 0) {
            setDashboardStudentMessage(`No approved students found for ${className}.`);
            return;
        }

        setDashboardStudentMessage(`${students.length} student${students.length === 1 ? "" : "s"} found in ${className}.`);
    } catch (error) {
        renderDashboardStudentList([]);
        setDashboardStudentMessage(error.message || "Unable to load students for the selected class.", true);
    }
}

function renderDashboardClassList(classes) {
    const tableBody = document.getElementById("dashboardClassTable");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (classes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td>No class records found.</td>
            </tr>
        `;
        return;
    }

    classes.forEach(classItem => {
        tableBody.innerHTML += `
            <tr>
                <td>${classItem.className || "-"}</td>
            </tr>
        `;
    });
}

function initializeStaffAttendanceDate() {
    const dateInput = document.getElementById("staffAttendanceDate");

    if (!dateInput) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    dateInput.value = `${year}-${month}-${day}`;
}

function handleStaffAttendanceDateChange() {
    loadStaffAttendanceRows();
    loadSavedStaffAttendanceTable();
}

function getStaffAttendanceStatusChip(status) {
    const normalizedStatus = String(status || "").trim();
    let statusClass = "ml";

    if (normalizedStatus === "Present") statusClass = "present";
    if (normalizedStatus === "Absent") statusClass = "absent";

    return `<span class="status-chip ${statusClass}">${normalizedStatus || "-"}</span>`;
}

function loadStaffAttendanceRows() {
    const tableBody = document.getElementById("staffAttendanceTableBody");
    const dateInput = document.getElementById("staffAttendanceDate");

    if (!tableBody || !dateInput) return;

    const selectedDate = dateInput.value;
    const faculty = JSON.parse(localStorage.getItem("faculty")) || [];
    const staffAttendance = JSON.parse(localStorage.getItem("staffAttendance")) || [];

    tableBody.innerHTML = "";

    if (faculty.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No faculty records found.</td>
            </tr>
        `;
        return;
    }

    faculty.forEach(member => {
        const savedRecord = staffAttendance.find(record =>
            record.date === selectedDate &&
            record.facultyEmail === member.email
        );
        const selectedStatus = savedRecord ? savedRecord.status : "Present";
        const statusId = `staff-status-${encodeURIComponent(member.email)}`;

        tableBody.innerHTML += `
            <tr>
                <td>${member.name || "-"}</td>
                <td>${member.email || "-"}</td>
                <td>
                    <select id="${statusId}">
                        <option value="Present" ${selectedStatus === "Present" ? "selected" : ""}>Present</option>
                        <option value="Absent" ${selectedStatus === "Absent" ? "selected" : ""}>Absent</option>
                        <option value="ML" ${selectedStatus === "ML" ? "selected" : ""}>ML</option>
                    </select>
                </td>
            </tr>
        `;
    });
}

function loadSavedStaffAttendanceTable() {
    const tableBody = document.getElementById("savedStaffAttendanceTableBody");
    const countBadge = document.getElementById("savedStaffAttendanceCount");
    const dateInput = document.getElementById("staffAttendanceDate");

    if (!tableBody || !dateInput) return;

    const selectedDate = dateInput.value;
    const activeEditIndex = window.editingStaffAttendanceIndex;
    const staffAttendance = (JSON.parse(localStorage.getItem("staffAttendance")) || [])
        .map((record, storageIndex) => ({ ...record, storageIndex }))
        .filter(record => !selectedDate || record.date === selectedDate)
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    tableBody.innerHTML = "";

    if (countBadge) {
        countBadge.innerText = `${staffAttendance.length} record${staffAttendance.length === 1 ? "" : "s"}`;
    }

    if (staffAttendance.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">No staff attendance saved for the selected date.</td>
            </tr>
        `;
        return;
    }

    staffAttendance.forEach(record => {
        const isEditing = activeEditIndex === record.storageIndex;
        const statusCell = isEditing
            ? `
                <select id="edit-staff-status-${record.storageIndex}" class="form-select form-select-sm attendance-inline-select">
                    <option value="Present" ${record.status === "Present" ? "selected" : ""}>Present</option>
                    <option value="Absent" ${record.status === "Absent" ? "selected" : ""}>Absent</option>
                    <option value="ML" ${record.status === "ML" ? "selected" : ""}>ML</option>
                </select>
            `
            : getStaffAttendanceStatusChip(record.status);

        const actionCell = isEditing
            ? `
                <div class="attendance-action-group">
                    <button type="button" class="btn btn-primary btn-sm btn-primary" onclick="updateStaffAttendanceRecord(${record.storageIndex})">Update</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" onclick="cancelStaffAttendanceEdit()">Cancel</button>
                </div>
            `
            : `
                <button type="button" class="btn btn-outline-primary btn-sm" onclick="editStaffAttendanceRecord(${record.storageIndex})">Edit</button>
            `;

        tableBody.innerHTML += `
            <tr>
                <td>${record.date || "-"}</td>
                <td>${record.facultyName || "-"}</td>
                <td>${record.facultyEmail || "-"}</td>
                <td>${statusCell}</td>
                <td>${actionCell}</td>
            </tr>
        `;
    });
}

function editStaffAttendanceRecord(storageIndex) {
    window.editingStaffAttendanceIndex = storageIndex;
    loadSavedStaffAttendanceTable();
}

function cancelStaffAttendanceEdit() {
    window.editingStaffAttendanceIndex = null;
    loadSavedStaffAttendanceTable();
}

async function updateStaffAttendanceRecord(storageIndex) {
    await ensureBackendData();

    const staffAttendance = JSON.parse(localStorage.getItem("staffAttendance")) || [];
    const statusSelect = document.getElementById(`edit-staff-status-${storageIndex}`);

    if (!statusSelect || !staffAttendance[storageIndex]) {
        alert("Unable to update the selected attendance record.");
        return;
    }

    if (!staffAttendance[storageIndex].id) {
        alert("Unable to update this record because it is not linked to the backend.");
        return;
    }

    await window.erpApi.staffAttendance.update(staffAttendance[storageIndex].id, {
        faculty: staffAttendance[storageIndex].facultyId,
        date: staffAttendance[storageIndex].date,
        status: statusSelect.value
    });
    await syncBackendData();

    window.editingStaffAttendanceIndex = null;

    loadStaffAttendanceRows();
    loadSavedStaffAttendanceTable();
    loadFacultyOwnAttendance();

    alert("Staff attendance updated successfully.");
}

async function saveStaffAttendance() {
    await ensureBackendData();

    const dateInput = document.getElementById("staffAttendanceDate");

    if (!dateInput || !dateInput.value) {
        alert("Please select an attendance date.");
        return;
    }

    const selectedDate = dateInput.value;
    const faculty = JSON.parse(localStorage.getItem("faculty")) || [];
    const staffAttendance = JSON.parse(localStorage.getItem("staffAttendance")) || [];

    await Promise.all(
        faculty.map(member => {
            const statusId = `staff-status-${encodeURIComponent(member.email)}`;
            const statusSelect = document.getElementById(statusId);

            if (!statusSelect || !member.id) {
                return Promise.resolve();
            }

            const existingRecord = staffAttendance.find(record =>
                record.date === selectedDate &&
                record.facultyId === member.id
            );
            const payload = {
                faculty: member.id,
                date: selectedDate,
                status: statusSelect.value
            };

            if (existingRecord && existingRecord.id) {
                return window.erpApi.staffAttendance.update(existingRecord.id, payload);
            }

            return window.erpApi.staffAttendance.create(payload);
        })
    );
    await syncBackendData();

    window.editingStaffAttendanceIndex = null;

    loadStaffAttendanceRows();
    loadSavedStaffAttendanceTable();
    loadFacultyOwnAttendance();

    alert("Staff attendance saved successfully.");
}

function logout() {
    window.location.href = "index.html";
}

function go(page) {
    window.location.href = page;
}
// Simulated registered students
let students = JSON.parse(localStorage.getItem("students")) || [];



async function loadPendingStudents() {
    await ensureBackendData();

    const tableBody = document.querySelector("#studentTable tbody");
    const students = readStorageArray("students");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    let pendingCount = 0;

    students.forEach((student, index) => {
        if (student.status === "Pending") {
            pendingCount++;
            let row = `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.email}</td>
                    <td>${student.class}</td>
                    <td>${student.status}</td>
                    <td>
                        <div class="attendance-action-group">
                            <button class="btn-primary"
                                onclick="approveStudent(${index})">
                                Approve
                            </button>
                            <button class="btn-danger"
                                onclick="rejectStudent(${index})">
                                Reject
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        }
    });

    if (pendingCount === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">No pending students right now.</td>
            </tr>
        `;
    }
}

async function approveStudent(index) {
    await ensureBackendData();

    const students = readStorageArray("students");
    const student = students[index];

    if (!student || !student.id) {
        alert("Student record not found.");
        return;
    }

    await window.erpApi.students.update(student.id, {
        status: "Approved"
    });
    await syncBackendData();

    // Reload students to get the generated roll
    const updatedStudents = readStorageArray("students");
    const updatedStudent = updatedStudents.find(s => s.id === student.id);
    const rollNo = updatedStudent ? updatedStudent.roll : "Generated";

    alert("Student Approved!\nRoll Number: " + rollNo);

    loadPendingStudents();
}

async function rejectStudent(index) {
    await ensureBackendData();

    const students = readStorageArray("students");
    const student = students[index];

    if (!student || !student.id) {
        alert("Student record not found.");
        return;
    }

    await window.erpApi.students.update(student.id, {
        status: "Rejected"
    });
    await syncBackendData();

    alert("Student Rejected!");

    loadPendingStudents();
}

const REGISTRATION_DISTRICT_TALUKA_MAP = {
    Pune: ["Haveli", "Mulshi", "Mawal", "Shirur", "Baramati", "Indapur"],
    Mumbai: ["Andheri", "Borivali", "Kurla", "Mulund", "Dadar", "Colaba"],
    Thane: ["Thane", "Kalyan", "Bhiwandi", "Murbad", "Shahapur", "Ambarnath"],
    Nashik: ["Nashik", "Niphad", "Sinnar", "Igatpuri", "Malegaon", "Yeola"],
    Nagpur: ["Nagpur Urban", "Hingna", "Kamptee", "Umred", "Katol", "Narkhed"],
    Kolhapur: ["Karveer", "Hatkanangale", "Panhala", "Shahuwadi", "Gadhinglaj", "Shirol"],
    Satara: ["Satara", "Karad", "Phaltan", "Wai", "Khandala", "Patan"],
    Solapur: ["North Solapur", "South Solapur", "Pandharpur", "Barshi", "Sangola", "Mohol"],
    Ahilyanagar: ["Ahilyanagar", "Sangamner", "Shrirampur", "Rahata", "Karjat", "Jamkhed"],
    Nanded: ["Nanded", "Loha", "Mukhed", "Kandhar", "Hadgaon", "Kinwat"]
};

function getRegistrationFieldElement(fieldName) {
    const fieldIdMap = {
        first_name: "firstName",
        middle_name: "middleName",
        last_name: "lastName",
        date_of_birth: "dateOfBirth",
        student_whatsapp_number: "studentWhatsappNumber",
        parent_whatsapp_number: "parentWhatsappNumber",
        sub_caste: "subCaste",
        academic_class: "className",
        abc_id: "abcId"
    };

    return document.getElementById(fieldIdMap[fieldName] || fieldName);
}

function clearRegistrationErrors() {
    const errorMessage = document.getElementById("registrationError");

    if (errorMessage) {
        errorMessage.style.display = "none";
        errorMessage.innerText = "";
    }

    document.querySelectorAll("#studentRegistrationForm .field-error").forEach(errorEl => {
        errorEl.innerText = "";
    });

    document.querySelectorAll("#studentRegistrationForm .field-invalid").forEach(fieldEl => {
        fieldEl.classList.remove("field-invalid");
    });
}

function showRegistrationFormError(message) {
    const errorMessage = document.getElementById("registrationError");
    if (!errorMessage) return;

    errorMessage.innerText = message;
    errorMessage.style.display = "block";
}

function clearRegistrationSuccessMessage() {
    const successMessage = document.getElementById("registrationSuccessMessage");
    if (!successMessage) return;

    successMessage.innerText = "";
    successMessage.style.display = "none";
}

function renderRegistrationErrors(errors = {}) {
    clearRegistrationErrors();

    const generalErrors = [];

    Object.entries(errors).forEach(([fieldName, fieldMessage]) => {
        if (!/^[a-zA-Z0-9_]+$/.test(fieldName) && fieldName !== "__all__") {
            generalErrors.push(Array.isArray(fieldMessage) ? fieldMessage.join(", ") : fieldMessage);
            return;
        }

        const normalizedMessage = Array.isArray(fieldMessage) ? fieldMessage.join(", ") : fieldMessage;
        const errorElement = document.querySelector(`[data-error-for="${fieldName}"]`);
        const fieldElement = getRegistrationFieldElement(fieldName);

        if (errorElement) {
            errorElement.innerText = normalizedMessage;
        } else if (fieldName === "__all__") {
            generalErrors.push(normalizedMessage);
        } else {
            generalErrors.push(`${fieldName}: ${normalizedMessage}`);
        }

        if (fieldElement) {
            fieldElement.classList.add("field-invalid");
        }
    });

    if (generalErrors.length > 0) {
        showRegistrationFormError(generalErrors.join("\n"));
    }
}

function parseRegistrationErrorMessage(message) {
    const rawMessage = String(message || "").trim();
    const errors = {};

    if (!rawMessage) {
        return errors;
    }

    if (rawMessage.includes("<!DOCTYPE html") || rawMessage.includes("<html") || rawMessage.includes("<pre")) {
        errors.__all__ = "The server returned an unexpected error response. Please check the backend logs and try again.";
        return errors;
    }

    rawMessage
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            const separatorIndex = line.indexOf(":");

            if (separatorIndex === -1) {
                errors.__all__ = errors.__all__
                    ? `${errors.__all__} ${line}`
                    : line;
                return;
            }

            const fieldName = line.slice(0, separatorIndex).trim();
            const fieldMessage = line.slice(separatorIndex + 1).trim();

            if (!/^[a-zA-Z0-9_]+$/.test(fieldName) && fieldName !== "detail") {
                errors.__all__ = errors.__all__
                    ? `${errors.__all__} ${line}`
                    : line;
                return;
            }

            errors[fieldName === "detail" ? "__all__" : fieldName] = fieldMessage;
        });

    return errors;
}

function sanitizeDigits(value) {
    return String(value || "").replace(/\D/g, "");
}

function populateRegistrationDistricts() {
    const districtSelect = document.getElementById("district");
    if (!districtSelect) return;

    districtSelect.innerHTML = "<option value=''>Select District</option>";

    Object.keys(REGISTRATION_DISTRICT_TALUKA_MAP).forEach(district => {
        districtSelect.innerHTML += `<option value="${district}">${district}</option>`;
    });
}

function populateRegistrationTalukas(selectedDistrict = "") {
    const talukaSelect = document.getElementById("taluka");
    if (!talukaSelect) return;

    const talukas = REGISTRATION_DISTRICT_TALUKA_MAP[selectedDistrict] || [];
    talukaSelect.innerHTML = "<option value=''>Select Taluka</option>";

    talukas.forEach(taluka => {
        talukaSelect.innerHTML += `<option value="${taluka}">${taluka}</option>`;
    });
}

function handleDistrictChange() {
    const districtSelect = document.getElementById("district");
    populateRegistrationTalukas(districtSelect ? districtSelect.value : "");
}

function collectRegistrationPayload() {
    const form = document.getElementById("studentRegistrationForm");
    const formData = new FormData(form);

    return {
        first_name: String(formData.get("first_name") || "").trim(),
        middle_name: String(formData.get("middle_name") || "").trim(),
        last_name: String(formData.get("last_name") || "").trim(),
        email: normalizeEmail(formData.get("email")),
        date_of_birth: String(formData.get("date_of_birth") || "").trim(),
        gender: String(formData.get("gender") || "").trim(),
        student_whatsapp_number: sanitizeDigits(formData.get("student_whatsapp_number")),
        parent_whatsapp_number: sanitizeDigits(formData.get("parent_whatsapp_number")),
        caste: String(formData.get("caste") || "").trim(),
        sub_caste: String(formData.get("sub_caste") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        district: String(formData.get("district") || "").trim(),
        taluka: String(formData.get("taluka") || "").trim(),
        pincode: sanitizeDigits(formData.get("pincode")),
        abc_id: String(formData.get("abc_id") || "").trim(),
        academic_class: Number(formData.get("academic_class") || 0),
        status: "Pending",
        roll: ""
    };
}

function validateRegistrationPayload(payload) {
    const errors = {};
    const students = readStorageArray("students");

    const requiredFields = {
        first_name: "First name is required.",
        last_name: "Last name is required.",
        email: "Email is required.",
        date_of_birth: "Date of birth is required.",
        gender: "Gender is required.",
        student_whatsapp_number: "Student WhatsApp number is required.",
        parent_whatsapp_number: "Parent WhatsApp number is required.",
        address: "Address is required.",
        district: "District is required.",
        taluka: "Taluka is required.",
        pincode: "Pincode is required.",
        academic_class: "Class is required."
    };

    Object.entries(requiredFields).forEach(([fieldName, message]) => {
        if (!payload[fieldName]) {
            errors[fieldName] = message;
        }
    });

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.email = "Enter a valid email address.";
    }

    if (payload.student_whatsapp_number && !/^\d{10}$/.test(payload.student_whatsapp_number)) {
        errors.student_whatsapp_number = "Student WhatsApp number must be 10 digits.";
    }

    if (payload.parent_whatsapp_number && !/^\d{10}$/.test(payload.parent_whatsapp_number)) {
        errors.parent_whatsapp_number = "Parent WhatsApp number must be 10 digits.";
    }

    if (payload.pincode && !/^\d{6}$/.test(payload.pincode)) {
        errors.pincode = "Pincode must be 6 digits.";
    }

    if (payload.email && students.some(student => normalizeEmail(student.email) === payload.email)) {
        errors.email = "Email already exists.";
    }

    if (
        payload.student_whatsapp_number &&
        students.some(student => sanitizeDigits(student.studentWhatsappNumber) === payload.student_whatsapp_number)
    ) {
        errors.student_whatsapp_number = "Student WhatsApp number already exists.";
    }

    if (
        payload.abc_id &&
        students.some(student => String(student.abcId || "").trim().toLowerCase() === payload.abc_id.toLowerCase())
    ) {
        errors.abc_id = "ABC ID already exists.";
    }

    return errors;
}

async function submitRegistration(event) {
    event.preventDefault();
    await ensureBackendData();

    clearRegistrationErrors();
    clearRegistrationSuccessMessage();

    const payload = collectRegistrationPayload();
    const validationErrors = validateRegistrationPayload(payload);

    if (Object.keys(validationErrors).length > 0) {
        renderRegistrationErrors(validationErrors);
        return;
    }

    try {
        await window.erpApi.students.create(payload);
        await syncBackendData();
    } catch (error) {
        const parsedErrors = parseRegistrationErrorMessage(error.message);

        if (Object.keys(parsedErrors).length > 0) {
            renderRegistrationErrors(parsedErrors);
        } else {
            showRegistrationFormError(error.message || "Unable to submit registration.");
        }
        return;
    }

    event.target.reset();

    const studentPanel = document.getElementById("studentRegistrationPanel");
    const successPanel = document.getElementById("registrationSuccessPanel");

    if (studentPanel) {
        studentPanel.style.display = "none";
    }

    if (successPanel) {
        successPanel.style.display = "block";
    }
}

async function populateRegistrationClasses() {
    const classSelect = document.getElementById("className");

    if (!classSelect) return;

    await ensureBackendData();

    const classes = readStorageArray("classes");

    if (classes.length === 0) {
        return;
    }

    classSelect.innerHTML = "<option value=''>Select Class</option>";

    classes.forEach(classItem => {
        classSelect.innerHTML += `<option value="${classItem.id}">${classItem.className}</option>`;
    });
}

function getRegistrationLink() {
    const registrationUrl = new URL("register.html", window.location.href);
    registrationUrl.searchParams.set("view", "student");
    return registrationUrl.href;
}

async function initializeRegistrationPage() {
    const hodPanel = document.getElementById("hodRegistrationPanel");
    const studentPanel = document.getElementById("studentRegistrationPanel");
    const registrationLinkInput = document.getElementById("registrationLink");
    const successPanel = document.getElementById("registrationSuccessPanel");
    const errorMessage = document.getElementById("registrationError");

    if (!hodPanel || !studentPanel) return;

    const role = localStorage.getItem("loggedInRole");
    const registrationLink = getRegistrationLink();
    const requestedView = new URLSearchParams(window.location.search).get("view");

    if (registrationLinkInput) {
        registrationLinkInput.value = registrationLink;
    }

    await populateRegistrationClasses();
    populateRegistrationDistricts();
    populateRegistrationTalukas();

    if (successPanel) {
        successPanel.style.display = "none";
    }

    if (errorMessage) {
        errorMessage.style.display = "none";
        errorMessage.innerText = "";
    }
    clearRegistrationSuccessMessage();

    if (requestedView === "student") {
        hodPanel.style.display = "none";
        studentPanel.style.display = "block";
        return;
    }

    if (role === "hod") {
        hodPanel.style.display = "block";
        studentPanel.style.display = "none";
        return;
    }

    hodPanel.style.display = "none";
    studentPanel.style.display = "block";
}

function updateRegistrationLinkStatus(message, isError = false) {
    const status = document.getElementById("registrationLinkStatus");
    if (!status) return;

    status.innerText = message;
    status.style.color = isError ? "#b83434" : "";
}

function copyRegistrationLink() {
    const registrationLink = document.getElementById("registrationLink");

    if (!registrationLink) return;

    registrationLink.select();
    registrationLink.setSelectionRange(0, registrationLink.value.length);

    const fallbackCopy = () => {
        try {
            document.execCommand("copy");
            updateRegistrationLinkStatus("Registration link copied.");
        } catch (error) {
            updateRegistrationLinkStatus("Unable to copy automatically. Please copy the link manually.", true);
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(registrationLink.value)
            .then(() => updateRegistrationLinkStatus("Registration link copied."))
            .catch(() => fallbackCopy());
        return;
    }

    fallbackCopy();
}

function openRegistrationLink() {
    const registrationLink = document.getElementById("registrationLink");
    if (!registrationLink) return;

    window.open(registrationLink.value, "_blank");
}
async function loadFacultyDashboard() {
    await ensureBackendData();

    const loggedInEmail = localStorage.getItem("loggedInUserEmail");
    const facultyList = readStorageArray("faculty");
    const assignments = readStorageArray("assignments");
    const students = readStorageArray("students");
    const normalize = value => String(value || "").trim().toLowerCase();

    const facultyObj = facultyList.find(f =>
        normalize(f.email) === normalize(loggedInEmail)
    );

    const subjectElement = document.getElementById("subjectName");
    const classElement = document.getElementById("className");
    const studentCountElement = document.getElementById("studentCountFaculty");
    const welcomeElement = document.getElementById("facultyWelcomeMessage");
    const welcomeSubtextElement = document.getElementById("facultyWelcomeSubtext");

    if (!subjectElement || !classElement || !studentCountElement) return;

    if (!facultyObj) {
        if (welcomeElement) {
            welcomeElement.innerText = "Welcome";
        }

        if (welcomeSubtextElement) {
            welcomeSubtextElement.innerText = "Your dashboard is ready.";
        }

        subjectElement.innerText = "No faculty data";
        classElement.innerText = "No class assigned";
        studentCountElement.innerText = "0";
        loadFacultyOwnAttendance();
        return;
    }

    const myAssignments = assignments.filter(a =>
        normalize(a.facultyEmail) === normalize(loggedInEmail) ||
        normalize(a.facultyName) === normalize(facultyObj.name)
    );

    const mySubjects = [...new Set(myAssignments.map(a => a.subjectName).filter(Boolean))];
    const myClasses = [...new Set(myAssignments.map(a => a.className).filter(Boolean))];
    const myStudents = students.filter(student =>
        student.status === "Approved" &&
        myClasses.some(className => normalize(className) === normalize(student.class))
    );

    subjectElement.innerText = mySubjects.length > 0
        ? mySubjects.join(", ")
        : "No subject assigned";

    classElement.innerText = myClasses.length > 0
        ? myClasses.join(", ")
        : "No class assigned";

    studentCountElement.innerText = myStudents.length;

    if (welcomeElement) {
        welcomeElement.innerText = `Welcome, ${facultyObj.name}`;
    }

    if (welcomeSubtextElement) {
        welcomeSubtextElement.innerText = "Here is your teaching overview for today.";
    }

    loadFacultyOwnAttendance();
}

async function loadFacultyOwnAttendance() {
    await ensureBackendData();

    const tableBody = document.getElementById("facultyAttendanceTableBody");
    const summaryBadge = document.getElementById("facultyAttendanceSummary");

    if (!tableBody) return;

    const loggedInEmail = localStorage.getItem("loggedInUserEmail");
    const facultyList = readStorageArray("faculty");
    const staffAttendance = readStorageArray("staffAttendance");
    const normalize = value => String(value || "").trim().toLowerCase();
    const facultyObj = facultyList.find(f => normalize(f.email) === normalize(loggedInEmail));

    const myAttendance = staffAttendance
        .filter(record =>
            normalize(record.facultyEmail) === normalize(loggedInEmail) ||
            (facultyObj && normalize(record.facultyName) === normalize(facultyObj.name))
        )
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    tableBody.innerHTML = "";

    if (summaryBadge) {
        summaryBadge.innerText = `${myAttendance.length} record${myAttendance.length === 1 ? "" : "s"}`;
    }

    if (myAttendance.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="2">No attendance records available for your account yet.</td>
            </tr>
        `;
        return;
    }

    myAttendance.forEach(record => {
        tableBody.innerHTML += `
            <tr>
                <td>${record.date || "-"}</td>
                <td>${getStaffAttendanceStatusChip(record.status)}</td>
            </tr>
        `;
    });
}
function getTodayIsoDate() {
    return formatDateForStorage(new Date());
}

function formatDateForStorage(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getDateRange(fromDate, toDate) {
    const dates = [];
    const start = new Date(`${fromDate}T12:00:00`);
    const end = new Date(`${toDate}T12:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return dates;
    }

    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        dates.push(formatDateForStorage(current));
    }

    return dates;
}

async function loadAttendance() {
    await ensureBackendData();

    const students = readStorageArray("students");
    const attendance = readStorageArray("attendance");
    const tableBody = document.querySelector("#attendanceTable tbody");

    if (!tableBody) return;

    const today = getTodayIsoDate();
    const approvedStudents = students.filter(student => student.status === "Approved");

    tableBody.innerHTML = "";

    if (approvedStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No approved students found.</td>
            </tr>
        `;
        await loadAttendanceSummary();
        return;
    }

    approvedStudents.forEach((student, index) => {
        const existingRecord = attendance.find(record =>
            record.studentId === student.id &&
            record.date === today
        );
        const selectedStatus = existingRecord ? existingRecord.status : "Present";

        tableBody.innerHTML += `
            <tr>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>
                    <select id="status-${index}">
                        <option value="Present" ${selectedStatus === "Present" ? "selected" : ""}>Present</option>
                        <option value="Absent" ${selectedStatus === "Absent" ? "selected" : ""}>Absent</option>
                        <option value="ML" ${selectedStatus === "ML" ? "selected" : ""}>ML</option>
                    </select>
                </td>
            </tr>
        `;
    });

    await loadAttendanceSummary();
}

function saveAttendance() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    let attendanceData = JSON.parse(localStorage.getItem("attendance")) || [];

    students.forEach((student, index) => {

        if (student.status === "Approved") {

            const status = document.getElementById(`status-${index}`).value;

            const record = {
                name: student.name,
                class: student.class,
                status: status,
                date: new Date().toLocaleDateString()
            };

            attendanceData.push(record);

        }
    });

    localStorage.setItem("attendance", JSON.stringify(attendanceData));

    alert("Attendance Saved Successfully!");

    loadAttendanceSummary();
}

function loadAttendanceSummary() {

    let attendance = JSON.parse(localStorage.getItem("attendance")) || [];
    const summaryTable = document.querySelector("#attendanceSummary tbody");

    if (!summaryTable) return;

    summaryTable.innerHTML = "";

    let summary = {};

    attendance.forEach(record => {

        if (!summary[record.name]) {
            summary[record.name] = { present: 0, absent: 0, ml: 0 };
        }

        if (record.status === "Present") {
            summary[record.name].present++;
        }
        else if (record.status === "Absent") {
            summary[record.name].absent++;
        }
        else if (record.status === "ML") {
            summary[record.name].ml++;
        }
    });

    for (let name in summary) {

        let present = summary[name].present;
        let absent = summary[name].absent;
        let ml = summary[name].ml;

        let total = present + absent + ml;

        let percentage = total > 0
            ? ((present / total) * 100).toFixed(2)
            : 0;

        summaryTable.innerHTML += `
            <tr>
                <td>${name}</td>
                <td>${present}</td>
                <td>${absent}</td>
                <td>${ml}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    }
}
let marksData = JSON.parse(localStorage.getItem("marks")) || [];

function loadMarksPage() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    const tableBody = document.querySelector("#marksTable tbody");
    tableBody.innerHTML = "";

    students.forEach((student, index) => {

        if (student.status === "Approved") {

            let row = `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.class}</td>
                    <td>
                        <input type="number" id="marks-${index}" min="0" max="100">
                    </td>
                </tr>
            `;

            tableBody.innerHTML += row;
        }
    });

    loadMarksSummary();
}

function saveMarks() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    const examType = document.getElementById("examType").value;

    students.forEach((student, index) => {

        if (student.status === "Approved") {

            const marks = document.getElementById(`marks-${index}`).value;

            if (marks !== "") {

                marksData.push({

    name: student.name,
    class: student.class,
    subject: currentFacultySubject,
    examType: examType,
    marks: marks

});
            }
        }
    });

    localStorage.setItem("marks", JSON.stringify(marksData));

    alert("Marks Saved Successfully!");

    loadMarksSummary();
}

function loadMarksSummary() {

    marksData = JSON.parse(localStorage.getItem("marks")) || [];
    const summaryTable = document.querySelector("#marksSummary tbody");
    summaryTable.innerHTML = "";

    marksData.forEach(record => {

        let row = `
            <tr>
                <td>${record.name}</td>
                <td>${record.examType}</td>
                <td>${record.marks}</td>
            </tr>
        `;

        summaryTable.innerHTML += row;
    });
}
async function loadStudentDashboard() {
    await ensureBackendData();

    let students = JSON.parse(localStorage.getItem("students")) || [];
    let attendance = JSON.parse(localStorage.getItem("attendance")) || [];
    let marks = JSON.parse(localStorage.getItem("marks")) || [];
    let student = requireApprovedStudentAccess();

    if (!student) {
        return;
    }

    document.getElementById("studentName").innerText = student.name;
    document.getElementById("studentRoll").innerText = student.roll;

    // Attendance calculation
    const normalize = value => String(value || "").trim().toLowerCase();
    let studentAttendance = attendance.filter(a =>
        normalize(a.name) === normalize(student.name)
    );

    let present = studentAttendance.filter(a => a.status === "Present").length;
    let total = studentAttendance.length;

    let percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

    document.getElementById("attendancePercent").innerText = percentage + "%";
    window.studentAttendanceHistory = studentAttendance;
    renderStudentAttendanceDetails();

    // Marks
    const tableBody = document.getElementById("studentMarksTable");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    let studentMarks = marks.filter(m =>
        (m.studentEmail && student.email &&
            String(m.studentEmail).toLowerCase() === String(student.email).toLowerCase()) ||
        (m.studentName && String(m.studentName).toLowerCase() === String(student.name).toLowerCase()) ||
        (m.name && String(m.name).toLowerCase() === String(student.name).toLowerCase())
    );

   studentMarks.forEach(record => {

    tableBody.innerHTML += `
        <tr>
            <td>${record.subject}</td>
            <td>${record.examType}</td>
            <td>${record.marks}</td>
        </tr>
    `;
});

    if (studentMarks.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No marks available yet.</td>
            </tr>
        `;
    }

}

function openStudentSubjectDetail(subjectId) {
    if (!subjectId) return;
    window.location.href = `student_subject_detail.html?subject=${encodeURIComponent(subjectId)}`;
}

function renderSemesterSubjectCards(subjects) {
    const grid = document.getElementById("semesterSubjectGrid");
    if (!grid) return;

    grid.innerHTML = "";

    if (!subjects.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No subjects found</h3>
                <p>Your class does not have any semester subjects assigned yet.</p>
            </div>
        `;
        return;
    }

    subjects.forEach(subject => {
        grid.innerHTML += `
            <button type="button" class="semester-subject-card" onclick="openStudentSubjectDetail(${subject.id})">
                <div class="subject-card-code">${subject.code || "No Code"}</div>
                <h3>${subject.name}</h3>
                <p><strong>Class:</strong> ${subject.class_name || "-"}</p>
                <p><strong>Faculty:</strong> ${subject.faculty_name || "Not assigned"}</p>
                <span class="subject-card-cta">View Details</span>
            </button>
        `;
    });
}

async function loadStudentSemesterDetails() {
    const student = requireApprovedStudentAccess();
    if (!student) {
        return;
    }

    const heading = document.getElementById("semesterStudentHeading");
    const subheading = document.getElementById("semesterStudentSubheading");

    if (heading) {
        heading.innerText = `${student.name}'s Semester Details`;
    }

    if (subheading) {
        subheading.innerText = student.class
            ? `Showing subjects mapped to ${student.class}.`
            : "Showing the subjects linked to your current class.";
    }

    try {
        const response = await window.erpApi.studentSubjects.list();
        renderSemesterSubjectCards(response.subjects || []);
    } catch (error) {
        const grid = document.getElementById("semesterSubjectGrid");
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>Unable to load semester subjects</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function getSubjectDetailQueryParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("subject");
}

function renderSubjectAttendanceTable(records) {
    const body = document.getElementById("subjectAttendanceTableBody");
    if (!body) return;

    body.innerHTML = "";

    if (!records.length) {
        body.innerHTML = `
            <tr>
                <td colspan="2">No attendance data</td>
            </tr>
        `;
        return;
    }

    records.forEach(record => {
        body.innerHTML += `
            <tr>
                <td>${record.date}</td>
                <td>${record.status}</td>
            </tr>
        `;
    });
}

function renderSubjectAssignments(assignments) {
    const body = document.getElementById("subjectAssignmentTableBody");
    if (!body) return;

    body.innerHTML = "";

    if (!assignments.length) {
        body.innerHTML = `
            <tr>
                <td colspan="4">No assignments found</td>
            </tr>
        `;
        return;
    }

    assignments.forEach(assignment => {
        body.innerHTML += `
            <tr>
                <td>${assignment.title}</td>
                <td>${assignment.due_date}</td>
                <td>${assignment.status}</td>
                <td>${assignment.marks ?? "-"}</td>
            </tr>
        `;
    });
}

function renderSubjectMarks(records) {
    const body = document.getElementById("subjectMarksTableBody");
    if (!body) return;

    body.innerHTML = "";

    if (!records.length) {
        body.innerHTML = `
            <tr>
                <td colspan="2">No marks available</td>
            </tr>
        `;
        return;
    }

    records.forEach(record => {
        body.innerHTML += `
            <tr>
                <td>${record.exam_type}</td>
                <td>${record.marks}</td>
            </tr>
        `;
    });
}

async function loadStudentSubjectDetail() {
    const student = requireApprovedStudentAccess();
    if (!student) {
        return;
    }

    const subjectId = getSubjectDetailQueryParam();
    const content = document.getElementById("subjectDetailContent");

    if (!subjectId) {
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <h3>Subject not selected</h3>
                    <p>Please choose a subject from Semester Details first.</p>
                </div>
            `;
        }
        return;
    }

    try {
        const response = await window.erpApi.studentSubjects.detail(subjectId);
        const { subject, attendance, assignments, marks } = response;

        document.getElementById("subjectDetailTitle").innerText = subject.name;
        document.getElementById("subjectDetailMeta").innerText =
            `${subject.code || "No Code"} | ${subject.class_name || "-"} | ${subject.faculty_name || "Faculty not assigned"}`;
        document.getElementById("subjectAttendancePercentage").innerText = `${attendance.summary.percentage}%`;
        document.getElementById("subjectAttendancePresent").innerText = attendance.summary.present_classes;
        document.getElementById("subjectAttendanceTotal").innerText = attendance.summary.total_classes;
        document.getElementById("subjectMarksTotal").innerText = marks.summary.total_marks;
        document.getElementById("subjectMarksAverage").innerText = marks.summary.average_marks;

        renderSubjectAttendanceTable(attendance.records || []);
        renderSubjectAssignments(assignments || []);
        renderSubjectMarks(marks.records || []);
    } catch (error) {
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <h3>Unable to load subject details</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function renderStudentAttendanceDetails() {
    const detailsBody = document.getElementById("attendanceDetailsBody");
    if (!detailsBody) return;

    const history = window.studentAttendanceHistory || [];
    detailsBody.innerHTML = "";

    if (history.length === 0) {
        detailsBody.innerHTML = `
            <tr>
                <td colspan="2">No attendance records available.</td>
            </tr>
        `;
        return;
    }

    history.slice().reverse().forEach(record => {
        const status = String(record.status || "").trim();
        let statusClass = "ml";
        if (status === "Present") statusClass = "present";
        if (status === "Absent") statusClass = "absent";

        detailsBody.innerHTML += `
            <tr>
                <td>${record.date || "-"}</td>
                <td><span class="status-chip ${statusClass}">${status || "-"}</span></td>
            </tr>
        `;
    });
}

function toggleStudentAttendanceDetails() {
    const detailsCard = document.getElementById("attendanceDetailsCard");
    if (!detailsCard) return;

    detailsCard.style.display = detailsCard.style.display === "none" ? "block" : "none";
}
function loadFacultyReport() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    let attendance = JSON.parse(localStorage.getItem("attendance")) || [];
    let marks = JSON.parse(localStorage.getItem("marks")) || [];

    // Total Lectures
    document.getElementById("totalLectures").innerText = attendance.length;

    // Attendance Summary
    const attendanceTable = document.getElementById("attendanceReport");
    attendanceTable.innerHTML = "";

    let summary = {};

    attendance.forEach(record => {

        if (!summary[record.name]) {
            summary[record.name] = { present: 0, absent: 0 };
        }

        if (record.status === "Present") {
            summary[record.name].present++;
        } else {
            summary[record.name].absent++;
        }
    });

    for (let name in summary) {

        let row = `
            <tr>
                <td>${name}</td>
                <td>${summary[name].present}</td>
                <td>${summary[name].absent}</td>
            </tr>
        `;

        attendanceTable.innerHTML += row;
    }

    // Marks Summary
    const marksTable = document.getElementById("marksReport");
    marksTable.innerHTML = "";

    marks.forEach(record => {
        const displayName = record.studentName || record.name || "N/A";

        let row = `
            <tr>
                <td>${displayName}</td>
                <td>${record.examType}</td>
                <td>${record.marks}</td>
            </tr>
        `;

        marksTable.innerHTML += row;
    });
}
function togglePassword() {

    const passwordField = document.getElementById("password");

    if (passwordField.type === "password") {
        passwordField.type = "text";
    } else {
        passwordField.type = "password";
    }
}
function loadStudentReport() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    let attendance = JSON.parse(localStorage.getItem("attendance")) || [];
    let marks = JSON.parse(localStorage.getItem("marks")) || [];
    const role = localStorage.getItem("loggedInRole");
    const loggedInEmail = localStorage.getItem("loggedInUserEmail");

    let selectedStudentEmail = document.getElementById("studentSelect").value;
    const printBtn = document.getElementById("printBtn");

    if (role === "student" && !requireApprovedStudentAccess()) {
        return;
    }

    if (role === "student" && selectedStudentEmail === "") {
        const autoStudent = students.find(s =>
            normalizeEmail(s.email) === normalizeEmail(loggedInEmail) &&
            String(s.status || "").toLowerCase() === "approved"
        );
        if (autoStudent) {
            selectedStudentEmail = autoStudent.email;
            document.getElementById("studentSelect").value = selectedStudentEmail;
        }
    }

    if (selectedStudentEmail === "") {
        printBtn.disabled = true;
        return;
    }
    printBtn.disabled = false;
    const student = students.find(s =>
        String(s.email || "").toLowerCase() === String(selectedStudentEmail || "").toLowerCase()
    );
    if (!student) {
        printBtn.disabled = true;
        return;
    }

    document.getElementById("reportName").innerText = student.name;
    document.getElementById("reportRoll").innerText = student.roll;
    document.getElementById("reportClass").innerText = student.class;

    // Attendance calculation
    let studentAttendance = attendance.filter(a => a.name === student.name);

    let present = studentAttendance.filter(a => a.status === "Present").length;
    let total = studentAttendance.length;
    let absent = total - present;
    let percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

    document.getElementById("totalLectures").innerText = total;
    document.getElementById("presentCount").innerText = present;
    document.getElementById("absentCount").innerText = absent;
    document.getElementById("attendancePercentage").innerText = percentage;

    // Marks
    const marksTable = document.getElementById("reportMarks");
    marksTable.innerHTML = "";

    let studentMarks = marks.filter(m =>
        (m.studentEmail && student.email &&
            String(m.studentEmail).toLowerCase() === String(student.email).toLowerCase()) ||
        (m.studentName && String(m.studentName).toLowerCase() === String(student.name).toLowerCase()) ||
        (m.name && String(m.name).toLowerCase() === String(student.name).toLowerCase())
    );

    studentMarks.forEach(record => {

        marksTable.innerHTML += `
            <tr>
                <td>${record.examType}</td>
                <td>${record.marks}</td>
            </tr>
        `;
    });
}
function loadStudentDropdown() {

    let students = JSON.parse(localStorage.getItem("students")) || [];
    const dropdown = document.getElementById("studentSelect");
    const role = localStorage.getItem("loggedInRole");
    const loggedInEmail = localStorage.getItem("loggedInUserEmail");
    const selectorWrap = document.getElementById("studentSelectorWrap");

    dropdown.innerHTML = '<option value="">-- Select Student --</option>';

    if (role === "student") {
        const student = requireApprovedStudentAccess();

        if (student) {
            dropdown.innerHTML = `<option value="${student.email}">${student.name} (${student.roll})</option>`;
            dropdown.value = student.email;
            if (selectorWrap) selectorWrap.style.display = "none";
            loadStudentReport();
            return;
        }
    }

    if (selectorWrap) selectorWrap.style.display = "block";
    students.forEach((student, index) => {
        if (student.status === "Approved") {
            dropdown.innerHTML +=
                `<option value="${student.email}">${student.name} (${student.roll})</option>`;
        }
    });
}
function loadRoleSidebar() {

    const role = localStorage.getItem("loggedInRole");
    const sidebar = document.getElementById("roleSidebar");

    if (!sidebar) return;

    if (role === "faculty") {
        sidebar.innerHTML = `
            <a href="faculty.html">Faculty Dashboard</a>
            <a href="print_student.html">PTM Report</a>
            <a href="index.html">Logout</a>
        `;
    }
    else if (role === "hod") {
        sidebar.innerHTML = `
            <a href="hod.html">HOD Dashboard</a>
            <a href="print_student.html">PTM Report</a>
            <a href="index.html">Logout</a>
        `;
    }
}
function printReport() {

    const selectedStudentEmail = document.getElementById("studentSelect").value;
    const role = localStorage.getItem("loggedInRole");

    if (selectedStudentEmail === "" && role !== "student") {
        alert("Please select a student before printing.");
        return;
    }

    // Always refresh selected data before print.
    loadStudentReport();
    window.print();
}

function getFacultyFieldElement(fieldName) {
    const fieldMap = {
        name: "facultyName",
        email: "facultyEmail",
        mobile_number: "facultyMobileNumber",
        qualification: "facultyQualification",
        experience: "facultyExperience",
        caste: "facultyCaste",
        sub_caste: "facultySubCaste",
        address: "facultyAddress",
        district: "facultyDistrict",
        taluka: "facultyTaluka"
    };

    return document.getElementById(fieldMap[fieldName] || "");
}

function clearFacultyFormErrors() {
    const formStatus = document.getElementById("facultyFormStatus");
    if (formStatus) {
        formStatus.style.display = "none";
        formStatus.innerText = "";
        formStatus.style.color = "";
    }

    document.querySelectorAll("#facultyForm .field-error").forEach(errorEl => {
        errorEl.innerText = "";
    });

    document.querySelectorAll("#facultyForm .field-invalid").forEach(fieldEl => {
        fieldEl.classList.remove("field-invalid");
    });
}

function showFacultyFormStatus(message, isError = false) {
    const formStatus = document.getElementById("facultyFormStatus");
    if (!formStatus) return;

    formStatus.innerText = message;
    formStatus.style.display = "block";
    formStatus.style.color = isError ? "#b83434" : "#177245";
}

function renderFacultyFormErrors(errors = {}) {
    clearFacultyFormErrors();

    const generalErrors = [];

    Object.entries(errors).forEach(([fieldName, fieldMessage]) => {
        if (!/^[a-zA-Z0-9_]+$/.test(fieldName) && fieldName !== "__all__") {
            generalErrors.push(Array.isArray(fieldMessage) ? fieldMessage.join(", ") : fieldMessage);
            return;
        }

        const normalizedMessage = Array.isArray(fieldMessage) ? fieldMessage.join(", ") : fieldMessage;
        const errorElement = document.querySelector(`#facultyForm [data-error-for="${fieldName}"]`);
        const fieldElement = getFacultyFieldElement(fieldName);

        if (errorElement) {
            errorElement.innerText = normalizedMessage;
        } else if (fieldName === "__all__") {
            generalErrors.push(normalizedMessage);
        } else {
            generalErrors.push(`${fieldName}: ${normalizedMessage}`);
        }

        if (fieldElement) {
            fieldElement.classList.add("field-invalid");
        }
    });

    if (generalErrors.length > 0) {
        showFacultyFormStatus(generalErrors.join("\n"), true);
    }
}

function parseFieldErrors(message) {
    const rawMessage = String(message || "").trim();
    const errors = {};

    if (!rawMessage) return errors;

    if (rawMessage.includes("<!DOCTYPE html") || rawMessage.includes("<html") || rawMessage.includes("<pre")) {
        errors.__all__ = "The server returned an unexpected error response. Please check the backend logs and try again.";
        return errors;
    }

    rawMessage
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            const separatorIndex = line.indexOf(":");

            if (separatorIndex === -1) {
                errors.__all__ = errors.__all__ ? `${errors.__all__} ${line}` : line;
                return;
            }

            const fieldName = line.slice(0, separatorIndex).trim();
            const fieldMessage = line.slice(separatorIndex + 1).trim();

            if (!/^[a-zA-Z0-9_]+$/.test(fieldName) && fieldName !== "detail") {
                errors.__all__ = errors.__all__ ? `${errors.__all__} ${line}` : line;
                return;
            }

            errors[fieldName === "detail" ? "__all__" : fieldName] = fieldMessage;
        });

    return errors;
}

function populateFacultyDistricts() {
    const districtSelect = document.getElementById("facultyDistrict");
    if (!districtSelect) return;

    districtSelect.innerHTML = "<option value=''>Select District</option>";

    Object.keys(REGISTRATION_DISTRICT_TALUKA_MAP).forEach(district => {
        districtSelect.innerHTML += `<option value="${district}">${district}</option>`;
    });
}

function populateFacultyTalukas(selectedDistrict = "") {
    const talukaSelect = document.getElementById("facultyTaluka");
    if (!talukaSelect) return;

    talukaSelect.innerHTML = "<option value=''>Select Taluka</option>";

    (REGISTRATION_DISTRICT_TALUKA_MAP[selectedDistrict] || []).forEach(taluka => {
        talukaSelect.innerHTML += `<option value="${taluka}">${taluka}</option>`;
    });
}

function handleFacultyDistrictChange() {
    const districtSelect = document.getElementById("facultyDistrict");
    populateFacultyTalukas(districtSelect ? districtSelect.value : "");
}

function getFacultyFormPayload() {
    const experienceValue = document.getElementById("facultyExperience").value.trim();

    return {
        name: document.getElementById("facultyName").value.trim(),
        email: document.getElementById("facultyEmail").value.trim().toLowerCase(),
        mobile_number: sanitizeDigits(document.getElementById("facultyMobileNumber").value),
        qualification: document.getElementById("facultyQualification").value.trim(),
        experience: experienceValue === "" ? null : Number(experienceValue),
        caste: document.getElementById("facultyCaste").value.trim(),
        sub_caste: document.getElementById("facultySubCaste").value.trim(),
        address: document.getElementById("facultyAddress").value.trim(),
        district: document.getElementById("facultyDistrict").value.trim(),
        taluka: document.getElementById("facultyTaluka").value.trim()
    };
}

function validateFacultyPayload(payload, currentFacultyId = null) {
    const errors = {};
    const facultyList = readStorageArray("faculty");

    if (!payload.name) errors.name = "Name is required.";
    if (!payload.email) errors.email = "Email is required.";
    if (!payload.mobile_number) errors.mobile_number = "Mobile number is required.";
    if (payload.experience === null || Number.isNaN(payload.experience)) errors.experience = "Experience is required.";
    if (!payload.address) errors.address = "Address is required.";
    if (!payload.district) errors.district = "District is required.";
    if (!payload.taluka) errors.taluka = "Taluka is required.";

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.email = "Enter a valid email address.";
    }

    if (payload.mobile_number && !/^\d{10}$/.test(payload.mobile_number)) {
        errors.mobile_number = "Mobile number must be exactly 10 digits.";
    }

    if (payload.experience !== null && !Number.isNaN(payload.experience) && payload.experience <= 0) {
        errors.experience = "Experience must be greater than 0.";
    }

    const comparableFaculty = facultyList.filter(member => Number(member.id) !== Number(currentFacultyId));

    if (payload.email && comparableFaculty.some(member => normalizeEmail(member.email) === payload.email)) {
        errors.email = "A faculty member with this email already exists.";
    }

    if (payload.mobile_number &&
        comparableFaculty.some(member => sanitizeDigits(member.mobileNumber) === payload.mobile_number)) {
        errors.mobile_number = "A faculty member with this mobile number already exists.";
    }

    return errors;
}

function resetFacultyForm(options = {}) {
    const { preserveStatus = false } = options;
    const form = document.getElementById("facultyForm");
    const facultyIdInput = document.getElementById("facultyId");
    const formTitle = document.getElementById("facultyFormTitle");
    const submitButton = document.getElementById("addFacultyButton");
    const cancelButton = document.getElementById("cancelFacultyEditButton");

    if (form) form.reset();
    if (facultyIdInput) facultyIdInput.value = "";
    if (formTitle) formTitle.innerText = "Add Faculty";
    if (submitButton) submitButton.innerText = "Save Faculty";
    if (cancelButton) cancelButton.style.display = "none";

    populateFacultyDistricts();
    populateFacultyTalukas();
    if (!preserveStatus) {
        clearFacultyFormErrors();
    } else {
        document.querySelectorAll("#facultyForm .field-error").forEach(errorEl => {
            errorEl.innerText = "";
        });
        document.querySelectorAll("#facultyForm .field-invalid").forEach(fieldEl => {
            fieldEl.classList.remove("field-invalid");
        });
    }
}

function editFaculty(id) {
    const faculty = readStorageArray("faculty").find(member => Number(member.id) === Number(id));
    if (!faculty) return;

    document.getElementById("facultyId").value = faculty.id;
    document.getElementById("facultyName").value = faculty.name || "";
    document.getElementById("facultyEmail").value = faculty.email || "";
    document.getElementById("facultyMobileNumber").value = faculty.mobileNumber || "";
    document.getElementById("facultyQualification").value = faculty.qualification || "";
    document.getElementById("facultyExperience").value = faculty.experience ?? "";
    document.getElementById("facultyCaste").value = faculty.caste || "";
    document.getElementById("facultySubCaste").value = faculty.subCaste || "";
    document.getElementById("facultyAddress").value = faculty.address || "";
    document.getElementById("facultyDistrict").value = faculty.district || "";
    populateFacultyTalukas(faculty.district || "");
    document.getElementById("facultyTaluka").value = faculty.taluka || "";

    document.getElementById("facultyFormTitle").innerText = "Edit Faculty";
    document.getElementById("addFacultyButton").innerText = "Update Faculty";
    document.getElementById("cancelFacultyEditButton").style.display = "inline-flex";
    clearFacultyFormErrors();
}

async function saveFaculty(event) {
    if (event) {
        event.preventDefault();
    }

    await ensureBackendData();

    clearFacultyFormErrors();

    const facultyId = Number(document.getElementById("facultyId").value || 0);
    const payload = getFacultyFormPayload();
    const validationErrors = validateFacultyPayload(payload, facultyId || null);

    if (Object.keys(validationErrors).length > 0) {
        renderFacultyFormErrors(validationErrors);
        return;
    }

    try {
        if (facultyId) {
            await window.erpApi.faculty.update(facultyId, payload);
        } else {
            await window.erpApi.faculty.create(payload);
        }
        await syncBackendData();
    } catch (error) {
        const parsedErrors = parseFieldErrors(error.message);
        if (Object.keys(parsedErrors).length > 0) {
            renderFacultyFormErrors(parsedErrors);
        } else {
            showFacultyFormStatus(`Unable to save faculty.\n${error.message}`, true);
        }
        return;
    }

    resetFacultyForm({ preserveStatus: true });
    showFacultyFormStatus(facultyId ? "Faculty updated successfully." : "Faculty added successfully.");
    loadFacultyList();
}

window.saveFaculty = saveFaculty;
window.addFaculty = saveFaculty;
window.loadFacultyList = loadFacultyList;
window.deleteFaculty = deleteFaculty;
window.editFaculty = editFaculty;
window.resetFacultyForm = resetFacultyForm;
window.handleFacultyDistrictChange = handleFacultyDistrictChange;

async function loadFacultyList() {
    await ensureBackendData();

    const faculty = readStorageArray("faculty");

    const table = document.getElementById("facultyTable");

    if (!table) return;

    table.innerHTML = "";

    faculty.forEach(f => {

        table.innerHTML += `
            <tr>
                <td>${f.name}</td>
                <td>${f.email}</td>
                <td>${f.mobileNumber || "-"}</td>
                <td>${f.qualification || "-"}</td>
                <td>${f.experience ?? "-"}</td>
                <td>${f.district || "-"}</td>
                <td>
                    <button onclick="editFaculty(${f.id})" class="btn-primary">
                        Edit
                    </button>
                    <button onclick="deleteFaculty(${f.id})" class="btn-danger">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    });
}

async function deleteFaculty(id) {
    await window.erpApi.faculty.remove(id);
    await syncBackendData();

    loadFacultyList();
}
async function addClass() {
    await ensureBackendData();

    const className = document.getElementById("classNameInput").value;

    if (!className) {
        alert("Enter class name");
        return;
    }

    await window.erpApi.classes.create({ class_name: className });
    await syncBackendData();

    document.getElementById("classNameInput").value = "";

    loadClasses();
}

async function loadClasses() {
    await ensureBackendData();

    const classes = readStorageArray("classes");

    const table = document.getElementById("classTable");

    if (!table) return;

    table.innerHTML = "";

    classes.forEach(c => {

        table.innerHTML += `
            <tr>
                <td>${c.className}</td>
                <td>
                    <button onclick="deleteClass(${c.id})" class="btn-danger">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    });
}

async function deleteClass(id) {
    await window.erpApi.classes.remove(id);
    await syncBackendData();

    loadClasses();
}

function getSubjectFormPayload() {
    const subjectName = document.getElementById("subjectNameInput").value.trim();
    const subjectCode = document.getElementById("subjectCodeInput").value.trim();
    const classId = document.getElementById("subjectClassInput").value;

    if (!subjectName || !classId) {
        alert("Please enter subject name and select class.");
        return null;
    }

    const payload = {
        name: subjectName,
        code: subjectCode,
        academic_class: Number(classId)
    };

    return payload;
}

function resetSubjectForm() {
    document.getElementById("subjectNameInput").value = "";
    document.getElementById("subjectCodeInput").value = "";
    document.getElementById("subjectClassInput").value = "";

    window.subjectBeingEdited = null;

    const submitButton = document.getElementById("subjectSubmitButton");
    const cancelButton = document.getElementById("subjectCancelEditButton");
    const formModeText = document.getElementById("subjectFormModeText");

    if (submitButton) {
        submitButton.textContent = "Add Subject";
    }

    if (cancelButton) {
        cancelButton.style.display = "none";
    }

    if (formModeText) {
        formModeText.textContent = "Add a new subject using name, code and class.";
    }
}

function startSubjectEdit(subjectId) {
    const subject = readStorageArray("subjects").find(item => Number(item.id) === Number(subjectId));

    if (!subject) {
        alert("Subject not found.");
        return;
    }

    document.getElementById("subjectNameInput").value = subject.subjectName || "";
    document.getElementById("subjectCodeInput").value = subject.subjectCode || "";
    document.getElementById("subjectClassInput").value = subject.academicClassId || "";

    window.subjectBeingEdited = subject.id;

    const submitButton = document.getElementById("subjectSubmitButton");
    const cancelButton = document.getElementById("subjectCancelEditButton");
    const formModeText = document.getElementById("subjectFormModeText");

    if (submitButton) {
        submitButton.textContent = "Update Subject";
    }

    if (cancelButton) {
        cancelButton.style.display = "inline-block";
    }

    if (formModeText) {
        formModeText.textContent = `Editing ${subject.subjectName}. Update the values and click Update Subject.`;
    }
}

function cancelSubjectEdit() {
    resetSubjectForm();
}

async function addSubject() {
    await ensureBackendData();

    const payload = getSubjectFormPayload();
    if (!payload) return;

    try {
        if (window.subjectBeingEdited) {
            await window.erpApi.subjects.update(window.subjectBeingEdited, payload);
        } else {
            await window.erpApi.subjects.create(payload);
        }
    } catch (error) {
        alert(`Unable to save subject: ${error.message}`);
        return;
    }

    await syncBackendData();
    resetSubjectForm();

    await loadSubjects();
    await loadAssignmentOptions();
}

function renderSubjectRows(subjects) {
    const table = document.getElementById("subjectTable");

    if (!table) return;

    if (!subjects.length) {
        table.innerHTML = `
            <tr>
                <td colspan="4">No subjects found.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = subjects.map(subject => `
        <tr>
            <td>${subject.subjectName}</td>
            <td>${subject.subjectCode || "-"}</td>
            <td>${subject.className || "-"}</td>
            <td>
                <button onclick="startSubjectEdit(${subject.id})" class="btn-primary">
                    Edit
                </button>
                <button onclick="deleteSubject(${subject.id})" class="btn-danger">
                    Remove
                </button>
            </td>
        </tr>
    `).join("");
}

function populateSubjectClassSelectors(classes) {
    const formClassSelect = document.getElementById("subjectClassInput");
    const filterClassSelect = document.getElementById("subjectFilterClassInput");

    if (formClassSelect) {
        formClassSelect.innerHTML = "<option value=''>Select Class</option>";
        classes.forEach(classRecord => {
            formClassSelect.innerHTML += `<option value="${classRecord.id}">${classRecord.className}</option>`;
        });
    }

    if (filterClassSelect) {
        const selectedValue = filterClassSelect.value || "";
        filterClassSelect.innerHTML = "<option value='all'>Show All Classes</option>";
        classes.forEach(classRecord => {
            filterClassSelect.innerHTML += `<option value="${classRecord.id}">${classRecord.className}</option>`;
        });

        const nextValue = selectedValue && [...filterClassSelect.options].some(option => option.value === selectedValue)
            ? selectedValue
            : "all";
        filterClassSelect.value = nextValue;

        if (!filterClassSelect.dataset.bound) {
            filterClassSelect.addEventListener("change", () => {
                loadSubjects(filterClassSelect.value);
            });
            filterClassSelect.dataset.bound = "true";
        }
    }
}

async function loadSubjects(preferredClassId = null) {
    await ensureBackendData();

    const classes = readStorageArray("classes");
    const table = document.getElementById("subjectTable");
    const filterClassSelect = document.getElementById("subjectFilterClassInput");

    if (!table) {
        return;
    }

    populateSubjectClassSelectors(classes);

    if (filterClassSelect && preferredClassId !== null) {
        filterClassSelect.value = `${preferredClassId}`;
    }

    const selectedClassId = filterClassSelect ? (filterClassSelect.value || "all") : "all";

    table.innerHTML = `
        <tr>
            <td colspan="4">Loading subjects...</td>
        </tr>
    `;

    try {
        const subjectsRaw = await window.erpApi.subjects.listByClass(selectedClassId);
        const subjects = subjectsRaw.map(normalizeSubjectRecord);
        renderSubjectRows(subjects);
    } catch (error) {
        table.innerHTML = `
            <tr>
                <td colspan="4">Unable to load subjects: ${error.message}</td>
            </tr>
        `;
    }
}

async function deleteSubject(id) {
    await window.erpApi.subjects.remove(id);
    await syncBackendData();

    await loadSubjects();
    await loadAssignmentOptions();
}
async function loadAssignmentOptions() {
    await ensureBackendData();

    const classes = readStorageArray("classes");
    const subjects = readStorageArray("subjects");
    const faculty = readStorageArray("faculty");

    const classSelect = document.getElementById("assignClass");
    const subjectSelect = document.getElementById("assignSubject");
    const facultySelect = document.getElementById("assignFaculty");
    const assignmentStatus = document.getElementById("subjectAssignmentStatus");

    if (!classSelect || !subjectSelect || !facultySelect) {
        return;
    }

    classSelect.innerHTML = "<option value=''>Select Class</option>";
    subjectSelect.innerHTML = "<option value=''>Select Subject</option>";
    facultySelect.innerHTML = "<option value=''>Select Faculty</option>";
    if (assignmentStatus) assignmentStatus.textContent = "";

    classes.forEach(c => {
        classSelect.innerHTML += `<option value="${c.id}">${c.className}</option>`;
    });

    faculty.forEach(f => {
        facultySelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
    });

    const updateSubjectDropdownForSelectedClass = () => {
        const selectedClassId = Number(classSelect.value);
        subjectSelect.innerHTML = "<option value=''>Select Subject</option>";
        if (assignmentStatus) assignmentStatus.textContent = "";

        if (!selectedClassId) {
            return;
        }

        const filteredSubjects = subjects.filter(subject => Number(subject.academicClassId) === selectedClassId);

        filteredSubjects.forEach(subject => {
            const existingAssignment = readStorageArray("assignments")
                .find(assignment => Number(assignment.subjectId) === Number(subject.id));
            const isAssigned = Boolean(existingAssignment);
            const label = `${subject.subjectName}${subject.subjectCode ? ` (${subject.subjectCode})` : ""}${
                isAssigned ? " - Already Assigned" : ""
            }`;

            subjectSelect.innerHTML += `
                <option value="${subject.id}" ${isAssigned ? "disabled" : ""}>
                    ${label}
                </option>
            `;
        });
    };

    classSelect.onchange = () => {
        updateSubjectDropdownForSelectedClass();
        loadAssignmentsTable();
    };

    subjectSelect.onchange = () => {
        const selectedSubjectId = Number(subjectSelect.value);
        if (!selectedSubjectId || !assignmentStatus) {
            if (assignmentStatus) assignmentStatus.textContent = "";
            return;
        }

        const existingAssignment = readStorageArray("assignments")
            .find(assignment => Number(assignment.subjectId) === selectedSubjectId);

        if (!existingAssignment) {
            assignmentStatus.textContent = "Selected subject is available for assignment.";
            return;
        }

        assignmentStatus.textContent = `Already assigned to ${existingAssignment.facultyName || "another faculty"}.`;
    };

    updateSubjectDropdownForSelectedClass();
    await loadAssignmentsTable();
}

function toggleWeeklyTimetable() {

    const toggle = document.getElementById("addTimetableToggle");
    const timetableCard = document.getElementById("weeklyTimetableCard");

    if (!toggle || !timetableCard) return;

    timetableCard.style.display = toggle.checked ? "block" : "none";

    if (!toggle.checked) {
        clearWeeklyTimetableInputs();
    }
}

function getWeeklyTimetable() {

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    return days
        .map(day => {
            const input = document.getElementById(`slot-${day}`);
            const slot = input ? input.value.trim() : "";

            return {
                day: day.charAt(0).toUpperCase() + day.slice(1),
                slot
            };
        })
        .filter(entry => entry.slot);
}

function clearWeeklyTimetableInputs() {

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    days.forEach(day => {
        const input = document.getElementById(`slot-${day}`);

        if (input) {
            input.value = "";
        }
    });
}

function populateWeeklyTimetableInputs(weeklyTimetable = []) {
    clearWeeklyTimetableInputs();

    weeklyTimetable.forEach(entry => {
        const dayKey = String(entry.day || "").trim().toLowerCase();
        const input = document.getElementById(`slot-${dayKey}`);

        if (input) {
            input.value = entry.slot || "";
        }
    });
}

function resetAssignmentForm() {
    const classSelect = document.getElementById("assignClass");
    const subjectSelect = document.getElementById("assignSubject");
    const facultySelect = document.getElementById("assignFaculty");
    const timetableToggle = document.getElementById("addTimetableToggle");
    const submitButton = document.getElementById("assignmentSubmitButton");
    const cancelButton = document.getElementById("assignmentCancelEditButton");
    const formModeText = document.getElementById("assignmentFormModeText");

    if (classSelect) classSelect.value = "";
    if (subjectSelect) subjectSelect.value = "";
    if (facultySelect) facultySelect.value = "";

    if (timetableToggle) {
        timetableToggle.checked = false;
        toggleWeeklyTimetable();
    } else {
        clearWeeklyTimetableInputs();
    }

    window.assignmentBeingEdited = null;

    if (submitButton) {
        submitButton.textContent = "Assign";
    }

    if (cancelButton) {
        cancelButton.style.display = "none";
    }

    if (formModeText) {
        formModeText.textContent = "Select class first, then assign an available subject to a faculty member.";
    }

    loadAssignmentsTable();
}

function startAssignmentEdit(assignmentId) {
    const assignments = readStorageArray("assignments");
    const assignment = assignments.find(item => Number(item.id) === Number(assignmentId));
    const classSelect = document.getElementById("assignClass");
    const subjectSelect = document.getElementById("assignSubject");
    const facultySelect = document.getElementById("assignFaculty");
    const timetableToggle = document.getElementById("addTimetableToggle");
    const submitButton = document.getElementById("assignmentSubmitButton");
    const cancelButton = document.getElementById("assignmentCancelEditButton");
    const formModeText = document.getElementById("assignmentFormModeText");

    if (!assignment || !classSelect || !subjectSelect || !facultySelect) {
        alert("Assignment not found.");
        return;
    }

    classSelect.value = assignment.academicClassId || "";
    if (typeof classSelect.onchange === "function") {
        classSelect.onchange();
    }
    subjectSelect.value = assignment.subjectId || "";
    facultySelect.value = assignment.facultyId || "";
    window.assignmentBeingEdited = assignment.id;

    const hasTimetable = Array.isArray(assignment.weeklyTimetable) && assignment.weeklyTimetable.length > 0;

    if (timetableToggle) {
        timetableToggle.checked = hasTimetable;
        toggleWeeklyTimetable();
    }

    populateWeeklyTimetableInputs(assignment.weeklyTimetable || []);

    if (submitButton) {
        submitButton.textContent = "Update Assignment";
    }

    if (cancelButton) {
        cancelButton.style.display = "inline-block";
    }

    if (formModeText) {
        formModeText.textContent = `Editing ${assignment.subjectName} for ${assignment.className}. Update the details and save.`;
    }
}

function cancelAssignmentEdit() {
    resetAssignmentForm();
}

function renderWeeklyTimetableDropdown(weeklyTimetable, assignmentIndex) {

    if (!Array.isArray(weeklyTimetable) || weeklyTimetable.length === 0) {
        return "Not added";
    }

    const options = weeklyTimetable
        .map(entry => `<option value="${entry.day}">${entry.day}</option>`)
        .join("");

    return `
        <select onchange="showSelectedTimetable(${assignmentIndex}, this.value)">
            <option value="">Show Timetable </option>
            ${options}
        </select>
        <div id="selectedTimetable-${assignmentIndex}" class="selected-timetable-output"></div>
    `;
}

function showSelectedTimetable(assignmentIndex, selectedDay) {

    const output = document.getElementById(`selectedTimetable-${assignmentIndex}`);

    if (!output) return;

    if (!selectedDay) {
        output.innerHTML = "";
        return;
    }

    const assignments = JSON.parse(localStorage.getItem("assignments")) || [];
    const assignment = assignments[assignmentIndex];
    const weeklyTimetable = assignment && Array.isArray(assignment.weeklyTimetable)
        ? assignment.weeklyTimetable
        : [];

    const selectedEntry = weeklyTimetable.find(entry => entry.day === selectedDay);

    if (!selectedEntry) {
        output.innerHTML = `
            <div>Selected: ${selectedDay}</div>
            <div>&rarr; Output: Not available</div>
        `;
        return;
    }

    output.innerHTML = `
        <div>Selected: ${selectedDay}</div>
        <div>&rarr; Output: ${selectedEntry.slot}</div>
    `;
}

function renderWeeklyTimetableSelector(assignmentIndex) {

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const options = days
        .map(day => `<option value="${day}">${day}</option>`)
        .join("");

    return `
        <select onchange="showSelectedTimetable(${assignmentIndex}, this.value)">
            <option value="">Show Time Table</option>
            ${options}
        </select>
        <div id="selectedTimetable-${assignmentIndex}" class="selected-timetable-output"></div>
    `;
}

async function loadAssignmentsTable() {
    const tableBody = document.getElementById("assignmentTableBody");
    const searchInput = document.getElementById("assignmentSearch");
    const classSelect = document.getElementById("assignClass");

    if (!tableBody || !classSelect) return;

    const selectedClassId = Number(classSelect.value);
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

    tableBody.innerHTML = "";

    if (!selectedClassId) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">Please select a class to view subjects.</td>
            </tr>
        `;
        return;
    }

    // Fetch only selected class rows to avoid loading all assignments by default.
    const subjectRows = await window.erpApi.assignments.listByClass(selectedClassId);

    const filteredRows = subjectRows.filter(row => {
        if (!searchTerm) return true;

        const searchableText = [
            row.class_name,
            row.subject_name,
            row.subject_code,
            row.faculty_name,
            row.faculty_email
        ]
            .join(" ")
            .toLowerCase();

        return searchableText.includes(searchTerm);
    });

    if (subjectRows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">No subjects found for this class.</td>
            </tr>
        `;
        return;
    }

    if (filteredRows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">No matching subjects found for this class.</td>
            </tr>
        `;
        return;
    }

    filteredRows.forEach(row => {
        const rowKey = `subject-${row.subject_id}`;

        tableBody.innerHTML += `
            <tr>
                <td>${row.class_name || "-"}</td>
                <td>${row.subject_name || "-"}${row.subject_code ? ` (${row.subject_code})` : ""}</td>
                <td>${row.faculty_name || "Not Assigned"}</td>
                <td>${row.faculty_email || "-"}</td>
                <td>${renderWeeklyTimetableDropdownForRow(rowKey, row.weekly_timetable || [])}</td>
                <td>
                    ${row.assignment_id ? `<button onclick="startAssignmentEdit(${row.assignment_id})" class="btn-primary">Edit</button>` : "-"}
                </td>
            </tr>
        `;
    });
}

function renderWeeklyTimetableDropdownForRow(rowKey, weeklyTimetable) {
    if (!Array.isArray(weeklyTimetable) || weeklyTimetable.length === 0) {
        return "Not added";
    }

    if (!window.filteredAssignmentTimetables) {
        window.filteredAssignmentTimetables = {};
    }

    window.filteredAssignmentTimetables[rowKey] = weeklyTimetable;

    const options = weeklyTimetable
        .map(entry => `<option value="${entry.day}">${entry.day}</option>`)
        .join("");

    return `
        <select onchange="showFilteredRowTimetable('${rowKey}', this.value)">
            <option value="">Show Timetable</option>
            ${options}
        </select>
        <div id="filtered-timetable-${rowKey}" class="selected-timetable-output"></div>
    `;
}

function showFilteredRowTimetable(rowKey, selectedDay) {
    const output = document.getElementById(`filtered-timetable-${rowKey}`);
    if (!output) return;

    if (!selectedDay) {
        output.innerHTML = "";
        return;
    }

    const timetableMap = window.filteredAssignmentTimetables || {};
    const weeklyTimetable = Array.isArray(timetableMap[rowKey]) ? timetableMap[rowKey] : [];
    const selectedEntry = weeklyTimetable.find(entry => entry.day === selectedDay);

    if (!selectedEntry) {
        output.innerHTML = `
            <div>Selected: ${selectedDay}</div>
            <div>&rarr; Output: Not available</div>
        `;
        return;
    }

    output.innerHTML = `
        <div>Selected: ${selectedDay}</div>
        <div>&rarr; Output: ${selectedEntry.slot}</div>
    `;
}

async function assignSubject() {
    await ensureBackendData();

    const facultyList = readStorageArray("faculty");

    const classId = Number(document.getElementById("assignClass").value);
    const subjectId = document.getElementById("assignSubject").value;
    const facultyId = Number(document.getElementById("assignFaculty").value);
    const facultyObj = facultyList.find(f => Number(f.id) === facultyId);
    const addTimetable = document.getElementById("addTimetableToggle");
    const weeklyTimetable = addTimetable && addTimetable.checked
        ? getWeeklyTimetable()
        : [];

    if (!classId || !subjectId || !facultyId) {
        alert("Please select class, subject and faculty.");
        return;
    }

    const classRecord = readStorageArray("classes").find(item => Number(item.id) === classId);
    const subjectRecord = findSubjectById(subjectId);

    if (!classRecord || !subjectRecord || !facultyObj) {
        alert("Please select valid class, subject and faculty.");
        return;
    }

    const assignments = readStorageArray("assignments");
    const existingAssignment = assignments.find(assignment =>
        Number(assignment.subjectId) === Number(subjectRecord.id)
    );

    if (existingAssignment && !window.assignmentBeingEdited) {
        alert("This subject is already assigned to another faculty.");
        return;
    }
    const payload = {
        academic_class: classRecord.id,
        subject: subjectRecord.id,
        faculty: facultyObj.id,
        weekly_timetable: weeklyTimetable
    };
    const isEditingAssignment = Boolean(window.assignmentBeingEdited);

    try {
        if (isEditingAssignment) {
            await window.erpApi.assignments.update(window.assignmentBeingEdited, payload);
        } else if (existingAssignment && existingAssignment.id) {
            await window.erpApi.assignments.update(existingAssignment.id, payload);
        } else {
            await window.erpApi.assignments.create(payload);
        }
    } catch (error) {
        alert(`Unable to save assignment: ${error.message}`);
        return;
    }
    await syncBackendData();

    resetAssignmentForm();

    alert(isEditingAssignment || existingAssignment ? "Subject assignment updated successfully" : "Subject assigned successfully");
}
async function loadFacultyClasses() {
    await ensureBackendData();

    const assignments = readStorageArray("assignments");
    const facultyEmail = localStorage.getItem("loggedInUserEmail");

    // Get faculty name from faculty list
    const facultyList = readStorageArray("faculty");
    const normalize = value => String(value || "").trim().toLowerCase();
    const facultyObj = facultyList.find(f => normalize(f.email) === normalize(facultyEmail));

    if (!facultyObj) return;

    const facultyName = facultyObj.name;
    const classSelect = document.getElementById("marksClass");
    if (!classSelect) return;

    classSelect.innerHTML = "<option value=''>Select Class</option>";

    const myAssignments = assignments.filter(a =>
        normalize(a.facultyEmail) === normalize(facultyEmail) ||
        normalize(a.facultyName) === normalize(facultyName)
    );
    const myClasses = [...new Set(myAssignments.map(a => a.className).filter(Boolean))];

    myClasses.forEach(className => {
        classSelect.innerHTML += `
            <option value="${className}">
                ${className}
            </option>
        `;
    });

    if (myClasses.length === 0) {
        classSelect.innerHTML += "<option value=''>No assigned classes</option>";
    }
}


async function loadFacultySubjects() {
    await ensureBackendData();

    const assignments = readStorageArray("assignments");
    const facultyEmail = localStorage.getItem("loggedInUserEmail");

    const facultyList = readStorageArray("faculty");
    const normalize = value => String(value || "").trim().toLowerCase();
    const facultyObj = facultyList.find(f => normalize(f.email) === normalize(facultyEmail));

    if (!facultyObj) return;

    const facultyName = facultyObj.name;

    const selectedClass = document.getElementById("marksClass").value;
    const subjectSelect = document.getElementById("marksSubject");

    subjectSelect.innerHTML = "<option value=''>Select Subject</option>";

    assignments
        .filter(a =>
            normalize(a.className) === normalize(selectedClass) &&
            (
                normalize(a.facultyEmail) === normalize(facultyEmail) ||
                normalize(a.facultyName) === normalize(facultyName)
            )
        )
        .forEach(a => {
            subjectSelect.innerHTML += `
                <option value="${a.subjectName}">
                    ${a.subjectName}
                </option>
            `;
        });

    loadStudentsDropdown();
    loadMarksTable();
}



function loadStudentsForMarks() {

    const students = JSON.parse(localStorage.getItem("students")) || [];

    const selectedClass = document.getElementById("marksClass").value;

    const tableBody = document.getElementById("marksTableBody");

    tableBody.innerHTML = "";

    const filteredStudents = students.filter(s =>
        s.class === selectedClass &&
        s.status === "Approved"
    );

    if (filteredStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="2">No students found</td>
            </tr>
        `;
        return;
    }

    filteredStudents.forEach((student, index) => {

        tableBody.innerHTML += `
            <tr>
                <td>${student.name}</td>
                <td>
                    <input type="number" id="marks-${index}">
                </td>
            </tr>
        `;
    });
}

async function saveSubjectWiseMarks() {
    await ensureBackendData();

    const selectedClass = document.getElementById("marksClass").value;
    const selectedSubject = document.getElementById("marksSubject").value;
    const selectedStudentEmail = document.getElementById("marksStudent").value;
    const examType = document.getElementById("examType").value;

    const marks = document.getElementById("studentMarksInput").value;

    if (!selectedClass || !selectedSubject || !selectedStudentEmail || marks === "") {
        alert("Please select class, subject, student and enter marks.");
        return;
    }

    const numericMarks = Number(marks);
    if (Number.isNaN(numericMarks) || numericMarks < 0 || numericMarks > 100) {
        alert("Marks must be between 0 and 100.");
        return;
    }

    const students = readStorageArray("students");

    const student = students.find(s => s.email === selectedStudentEmail);
    if (!student) {
        alert("Selected student not found.");
        return;
    }

    const classRecord = findClassByName(selectedClass);
    const subjectRecord = findSubjectByName(selectedSubject);

    if (!classRecord || !subjectRecord) {
        alert("Selected class or subject was not found in the database.");
        return;
    }

    const marksData = readStorageArray("marks");
    const existingMark = marksData.find(record =>
        record.studentId === student.id &&
        record.academicClassId === classRecord.id &&
        record.subjectId === subjectRecord.id &&
        record.examType === examType
    );
    const payload = {
        student: student.id,
        academic_class: classRecord.id,
        subject: subjectRecord.id,
        exam_type: examType,
        marks: numericMarks
    };

    if (existingMark && existingMark.id) {
        await window.erpApi.marks.update(existingMark.id, payload);
    } else {
        await window.erpApi.marks.create(payload);
    }
    await syncBackendData();

    alert(existingMark ? "Marks updated successfully" : "Marks saved successfully");
    loadMarksTable();
}

async function loadStudentsDropdown() {
    await ensureBackendData();

    const students = readStorageArray("students");

    const selectedClass = document.getElementById("marksClass").value;

    const studentSelect = document.getElementById("marksStudent");

    studentSelect.innerHTML = "<option value=''>Select Student</option>";
    if (!selectedClass) return;

    const normalize = value => String(value || "").trim().toLowerCase();
    const filteredStudents = students.filter(s =>
        s.class &&
        s.status &&
        normalize(s.class) === normalize(selectedClass) &&
        normalize(s.status) === "approved"
    );

    filteredStudents.forEach(student => {

        studentSelect.innerHTML += `
            <option value="${student.email}">
                ${student.name}
            </option>
        `;
    });
}
async function loadMarksTable() {
    await ensureBackendData();

    const marksData = readStorageArray("marks");

    const selectedClass = document.getElementById("marksClass").value;
    const selectedSubject = document.getElementById("marksSubject").value;
    const selectedExamType = document.getElementById("examType").value;

    const tableBody = document.getElementById("marksTableBody");

    if (!tableBody) return;

    tableBody.innerHTML = "";

    const normalize = value => String(value || "").trim().toLowerCase();
    const filteredMarks = marksData.filter(m =>
        m.className &&
        m.subject &&
        m.examType &&
        normalize(m.className) === normalize(selectedClass) &&
        normalize(m.subject) === normalize(selectedSubject) &&
        (
            !selectedExamType ||
            normalize(m.examType) === normalize(selectedExamType)
        )
    );

    if (filteredMarks.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No marks entered yet</td>
            </tr>
        `;
        return;
    }

    filteredMarks.forEach(record => {

        tableBody.innerHTML += `
            <tr>
                <td>${record.studentName}</td>
                <td>${record.examType}</td>
                <td>${record.marks}</td>
            </tr>
        `;
    });
}
/* ===============================
   LEAVE APPLY SYSTEM
================================ */

function applyLeave(event, type) {

    event.preventDefault();

    let leaves = JSON.parse(localStorage.getItem("leaves")) || [];

    const email = localStorage.getItem("loggedInUserEmail");
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;
    const reason = document.getElementById("reason").value;

    let name = "";
    let className = "";

    if (type === "student") {

        const students = JSON.parse(localStorage.getItem("students")) || [];
        const student = students.find(s => s.email === email);
        if (!student) {
            alert("Student record not found. Please login again.");
            return;
        }

        name = student.name;
        className = student.class;

    } else if (type === "faculty") {

        const faculty = JSON.parse(localStorage.getItem("faculty")) || [];
        const f = faculty.find(f => f.email === email);
        if (!f) {
            alert("Faculty record not found. Please login again.");
            return;
        }

        name = f.name;
        className = "Faculty";
    }

    leaves.push({
        type,
        name,
        email,
        className,
        fromDate,
        toDate,
        reason,
        status: "Pending"
    });

    localStorage.setItem("leaves", JSON.stringify(leaves));

    alert("Leave Applied Successfully!");

    document.querySelector("form").reset();
}
/* ===============================
   HOD LEAVE APPROVAL
================================ */

function loadPendingLeaves() {

    let leaves = JSON.parse(localStorage.getItem("leaves")) || [];

    const table = document.getElementById("leaveTableBody");

    if (!table) return;

    table.innerHTML = "";

    leaves.forEach((leave, index) => {

        if (leave.status === "Pending") {

            table.innerHTML += `
                <tr>
                    <td>${leave.name}</td>
                    <td>${leave.type}</td>
                    <td>${leave.fromDate}</td>
                    <td>${leave.toDate}</td>
                    <td>${leave.reason}</td>
                    <td>
                        <button onclick="approveLeave(${index})">Approve</button>
                        <button onclick="rejectLeave(${index})">Reject</button>
                    </td>
                </tr>
            `;
        }
    });
}
function approveLeave(index) {

    let leaves = JSON.parse(localStorage.getItem("leaves")) || [];
    let attendance = JSON.parse(localStorage.getItem("attendance")) || [];

    const leave = leaves[index];

    leave.status = "Approved";

    // Mark attendance as ML for date range
    const start = new Date(leave.fromDate);
    const end = new Date(leave.toDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

        attendance.push({
            name: leave.name,
            class: leave.className,
            status: "ML",
            date: d.toLocaleDateString()
        });
    }

    localStorage.setItem("leaves", JSON.stringify(leaves));
    localStorage.setItem("attendance", JSON.stringify(attendance));

    alert("Leave Approved & Marked as ML");

    loadPendingLeaves();
}
function loadLeaveStatus() {

    let leaves = JSON.parse(localStorage.getItem("leaves")) || [];

    const email = localStorage.getItem("loggedInUserEmail");

    const table = document.getElementById("leaveStatusTable");

    if (!table) return;

    table.innerHTML = "";

    const myLeaves = leaves.filter(l => l.email === email);

    if (myLeaves.length === 0) {

        table.innerHTML = `
        <tr>
        <td colspan="4">No Leave Applied</td>
        </tr>
        `;

        return;
    }

    myLeaves.forEach(leave => {

        let statusColor = "";

        if (leave.status === "Pending") {
            statusColor = "orange";
        }
        else if (leave.status === "Approved") {
            statusColor = "green";
        }
        else if (leave.status === "Rejected") {
            statusColor = "red";
        }

        table.innerHTML += `
        <tr>
        <td>${leave.fromDate}</td>
        <td>${leave.toDate}</td>
        <td>${leave.reason}</td>
        <td style="color:${statusColor}; font-weight:bold;">
        ${leave.status}
        </td>
        </tr>
        `;
    });
}
function rejectLeave(index) {

    let leaves = JSON.parse(localStorage.getItem("leaves")) || [];

    leaves[index].status = "Rejected";

    localStorage.setItem("leaves", JSON.stringify(leaves));

    alert("Leave Rejected");

    loadPendingLeaves();
}

function highlightActiveNav() {
    const currentFile = window.location.pathname.split("/").pop().toLowerCase();
    const links = document.querySelectorAll(".sidebar a");

    links.forEach(link => {
        const href = (link.getAttribute("href") || "").toLowerCase();
        if (href === currentFile) {
            link.classList.add("active");
        }
    });
}

function addAutoBackButton() {
    const pagesWithoutBack = ["index.html", "hod.html", "faculty.html", "student.html"];
    const currentFile = window.location.pathname.split("/").pop().toLowerCase();

    if (pagesWithoutBack.includes(currentFile)) {
        return;
    }

    const header = document.querySelector(".header");
    if (!header) return;

    const hasBackButton = Array.from(header.querySelectorAll("button")).some(btn =>
        btn.textContent.trim().toLowerCase() === "back"
    );

    if (hasBackButton) return;

    const backButton = document.createElement("button");
    backButton.className = "btn-danger";
    backButton.textContent = "Back";
    backButton.onclick = () => window.history.back();
    header.appendChild(backButton);
}

async function checkBackendConnection() {
    if (!window.erpApi || !window.erpApi.health) {
        return;
    }

    try {
        const response = await window.erpApi.health();
        localStorage.setItem("backendStatus", response.status || "ok");
        console.log("Backend connected:", response.message);
    } catch (error) {
        localStorage.setItem("backendStatus", "offline");
        console.warn("Backend connection unavailable:", error.message);
    }
}

function readStorageArray(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        console.warn(`Unable to read local storage key "${key}":`, error.message);
        return [];
    }
}

function writeStorageArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function normalizeClassRecord(record) {
    return {
        id: record.id,
        className: record.class_name
    };
}

function normalizeStudentRecord(record, classesById = new Map()) {
    const classRecord = classesById.get(record.academic_class);
    const fullName = record.name || [record.first_name, record.middle_name, record.last_name]
        .filter(Boolean)
        .join(" ");

    return {
        id: record.id,
        name: fullName,
        firstName: record.first_name || "",
        middleName: record.middle_name || "",
        lastName: record.last_name || "",
        email: record.email,
        parentMobile: record.parent_mobile || record.parent_whatsapp_number || "",
        parentWhatsappNumber: record.parent_whatsapp_number || "",
        studentWhatsappNumber: record.student_whatsapp_number || "",
        dateOfBirth: record.date_of_birth || "",
        gender: record.gender || "",
        caste: record.caste || "",
        subCaste: record.sub_caste || "",
        address: record.address || "",
        district: record.district || "",
        taluka: record.taluka || "",
        pincode: record.pincode || "",
        abcId: record.abc_id || "",
        class: record.academic_class_name || (classRecord ? classRecord.className : ""),
        academicClassId: record.academic_class,
        status: record.status,
        roll: record.roll
    };
}

function normalizeFacultyRecord(record) {
    return {
        id: record.id,
        name: record.name,
        email: record.email,
        mobileNumber: record.mobile_number || "",
        qualification: record.qualification || "",
        experience: record.experience,
        caste: record.caste || "",
        subCaste: record.sub_caste || "",
        address: record.address || "",
        district: record.district || "",
        taluka: record.taluka || ""
    };
}

function normalizeSubjectRecord(record) {
    return {
        id: record.id,
        subjectName: record.name,
        subjectCode: record.code || "",
        academicClassId: record.academic_class || null,
        className: record.academic_class_name || ""
    };
}

function normalizeAssignmentRecord(record) {
    return {
        id: record.id,
        className: record.class_name || "",
        subjectName: record.subject_name || "",
        facultyName: record.faculty_name || "",
        facultyEmail: record.faculty_email || "",
        academicClassId: record.academic_class,
        subjectId: record.subject,
        facultyId: record.faculty,
        weeklyTimetable: Array.isArray(record.weekly_timetable) ? record.weekly_timetable : []
    };
}

function normalizeStudentAttendanceRecord(record, studentsById = new Map()) {
    const student = studentsById.get(record.student);

    return {
        id: record.id,
        studentId: record.student,
        studentEmail: student ? student.email : "",
        name: record.student_name || (student ? student.name : ""),
        class: student ? student.class : "",
        subjectId: record.subject || null,
        subjectName: record.subject_name || "",
        status: record.status,
        date: record.date
    };
}

function normalizeAssignmentItemRecord(record) {
    return {
        id: record.id,
        subjectId: record.subject,
        subjectName: record.subject_name || "",
        title: record.title,
        dueDate: record.due_date,
        description: record.description || ""
    };
}

function normalizeSubmissionRecord(record, studentsById = new Map()) {
    const student = studentsById.get(record.student);

    return {
        id: record.id,
        studentId: record.student,
        studentEmail: student ? student.email : "",
        studentName: record.student_name || (student ? student.name : ""),
        assignmentId: record.assignment,
        assignmentTitle: record.assignment_title || "",
        submitted: Boolean(record.submitted),
        marks: record.marks,
        submittedAt: record.submitted_at || ""
    };
}

function normalizeStaffAttendanceRecord(record, facultyById = new Map()) {
    const faculty = facultyById.get(record.faculty);

    return {
        id: record.id,
        facultyId: record.faculty,
        facultyName: record.faculty_name || (faculty ? faculty.name : ""),
        facultyEmail: record.faculty_email || (faculty ? faculty.email : ""),
        status: record.status,
        date: record.date
    };
}

function normalizeMarkRecord(record, studentsById = new Map()) {
    const student = studentsById.get(record.student);

    return {
        id: record.id,
        studentId: record.student,
        studentEmail: student ? student.email : "",
        studentName: record.student_name || (student ? student.name : ""),
        className: record.class_name || "",
        subject: record.subject_name || "",
        subjectId: record.subject,
        academicClassId: record.academic_class,
        examType: record.exam_type,
        marks: record.marks
    };
}

function normalizeLeaveRecord(record, studentsById = new Map(), facultyById = new Map()) {
    const student = record.student ? studentsById.get(record.student) : null;
    const faculty = record.faculty ? facultyById.get(record.faculty) : null;

    return {
        id: record.id,
        type: record.leave_type,
        name: record.student_name || record.faculty_name || (student ? student.name : "") || (faculty ? faculty.name : ""),
        email: student ? student.email : (faculty ? faculty.email : ""),
        className: student ? student.class : "Faculty",
        fromDate: record.from_date,
        toDate: record.to_date,
        reason: record.reason,
        status: record.status,
        studentId: record.student,
        facultyId: record.faculty
    };
}

async function syncBackendData() {
    if (!window.erpApi) {
        return;
    }

    const results = await Promise.allSettled([
        window.erpApi.classes.list(),
        window.erpApi.students.list(),
        window.erpApi.faculty.list(),
        window.erpApi.subjects.list(),
        window.erpApi.assignments.list(),
        window.erpApi.assignmentItems.list(),
        window.erpApi.submissions.list(),
        window.erpApi.leaves.list(),
        window.erpApi.marks.list(),
        window.erpApi.studentAttendance.list(),
        window.erpApi.staffAttendance.list()
    ]);

    const [
        classesResult,
        studentsResult,
        facultyResult,
        subjectsResult,
        assignmentsResult,
        assignmentItemsResult,
        submissionsResult,
        leavesResult,
        marksResult,
        studentAttendanceResult,
        staffAttendanceResult
    ] = results;

    const classesRaw = classesResult.status === "fulfilled" ? classesResult.value : [];
    const studentsRaw = studentsResult.status === "fulfilled" ? studentsResult.value : [];
    const facultyRaw = facultyResult.status === "fulfilled" ? facultyResult.value : [];
    const subjectsRaw = subjectsResult.status === "fulfilled" ? subjectsResult.value : [];
    const assignmentsRaw = assignmentsResult.status === "fulfilled" ? assignmentsResult.value : [];
    const assignmentItemsRaw = assignmentItemsResult.status === "fulfilled" ? assignmentItemsResult.value : [];
    const submissionsRaw = submissionsResult.status === "fulfilled" ? submissionsResult.value : [];
    const leavesRaw = leavesResult.status === "fulfilled" ? leavesResult.value : [];
    const marksRaw = marksResult.status === "fulfilled" ? marksResult.value : [];
    const studentAttendanceRaw = studentAttendanceResult.status === "fulfilled" ? studentAttendanceResult.value : [];
    const staffAttendanceRaw = staffAttendanceResult.status === "fulfilled" ? staffAttendanceResult.value : [];

    const classes = classesRaw.map(normalizeClassRecord);
    const classesById = new Map(classes.map(record => [record.id, record]));

    const students = studentsRaw.map(record => normalizeStudentRecord(record, classesById));
    const studentsById = new Map(students.map(record => [record.id, record]));

    const faculty = facultyRaw.map(normalizeFacultyRecord);
    const facultyById = new Map(faculty.map(record => [record.id, record]));

    const subjects = subjectsRaw.map(normalizeSubjectRecord);
    const assignments = assignmentsRaw.map(normalizeAssignmentRecord);
    const assignmentItems = assignmentItemsRaw.map(normalizeAssignmentItemRecord);
    const attendance = studentAttendanceRaw.map(record => normalizeStudentAttendanceRecord(record, studentsById));
    const staffAttendance = staffAttendanceRaw.map(record => normalizeStaffAttendanceRecord(record, facultyById));
    const marks = marksRaw.map(record => normalizeMarkRecord(record, studentsById));
    const submissions = submissionsRaw.map(record => normalizeSubmissionRecord(record, studentsById));
    const leaves = leavesRaw.map(record => normalizeLeaveRecord(record, studentsById, facultyById));

    writeStorageArray("classes", classes);
    writeStorageArray("students", students);
    writeStorageArray("faculty", faculty);
    writeStorageArray("subjects", subjects);
    writeStorageArray("assignments", assignments);
    writeStorageArray("assignmentItems", assignmentItems);
    writeStorageArray("submissions", submissions);
    writeStorageArray("attendance", attendance);
    writeStorageArray("staffAttendance", staffAttendance);
    writeStorageArray("marks", marks);
    writeStorageArray("leaves", leaves);
}

async function ensureBackendData() {
    if (!window.erpApi) {
        return;
    }

    try {
        await syncBackendData();
    } catch (error) {
        console.warn("Unable to sync backend data:", error.message);
    }
}

function findClassByName(className) {
    return readStorageArray("classes").find(item => item.className === className);
}

function findFacultyByEmail(email) {
    return readStorageArray("faculty").find(item => item.email === email);
}

function findSubjectByName(subjectName) {
    return readStorageArray("subjects").find(item => item.subjectName === subjectName);
}

function findSubjectById(subjectId) {
    return readStorageArray("subjects").find(item => Number(item.id) === Number(subjectId));
}

// These overrides keep the legacy screens working while routing persistence
// through the Django API instead of unsynced local-only data.
async function loadAttendance() {
    await ensureBackendData();

    const students = readStorageArray("students");
    const attendance = readStorageArray("attendance");
    const tableBody = document.querySelector("#attendanceTable tbody");

    if (!tableBody) return;

    const today = getTodayIsoDate();
    const approvedStudents = students.filter(student => student.status === "Approved");

    tableBody.innerHTML = "";

    if (approvedStudents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No approved students found.</td>
            </tr>
        `;
        await loadAttendanceSummary();
        return;
    }

    approvedStudents.forEach((student, index) => {
        const existingRecord = attendance.find(record =>
            record.studentId === student.id &&
            record.date === today
        );
        const selectedStatus = existingRecord ? existingRecord.status : "Present";

        tableBody.innerHTML += `
            <tr>
                <td>${student.name}</td>
                <td>${student.class}</td>
                <td>
                    <select id="status-${index}">
                        <option value="Present" ${selectedStatus === "Present" ? "selected" : ""}>Present</option>
                        <option value="Absent" ${selectedStatus === "Absent" ? "selected" : ""}>Absent</option>
                        <option value="ML" ${selectedStatus === "ML" ? "selected" : ""}>ML</option>
                    </select>
                </td>
            </tr>
        `;
    });

    await loadAttendanceSummary();
}

async function saveAttendance() {
    await ensureBackendData();

    const students = readStorageArray("students").filter(student => student.status === "Approved");
    const attendance = readStorageArray("attendance");
    const today = getTodayIsoDate();

    for (const [index, student] of students.entries()) {
        const statusInput = document.getElementById(`status-${index}`);

        if (!statusInput) {
            continue;
        }

        const payload = {
            student: student.id,
            date: today,
            status: statusInput.value
        };
        const existingRecord = attendance.find(record =>
            record.studentId === student.id &&
            record.date === today
        );

        if (existingRecord && existingRecord.id) {
            await window.erpApi.studentAttendance.update(existingRecord.id, payload);
        } else {
            await window.erpApi.studentAttendance.create(payload);
        }

    }

    await syncBackendData();

    alert("Attendance saved successfully.");

    await loadAttendance();
}

async function loadAttendanceSummary() {
    await ensureBackendData();

    const attendance = readStorageArray("attendance");
    const summaryTable = document.querySelector("#attendanceSummary tbody");

    if (!summaryTable) return;

    summaryTable.innerHTML = "";

    const summary = {};

    attendance.forEach(record => {
        if (!summary[record.name]) {
            summary[record.name] = { present: 0, absent: 0, ml: 0 };
        }

        if (record.status === "Present") {
            summary[record.name].present += 1;
        } else if (record.status === "Absent") {
            summary[record.name].absent += 1;
        } else if (record.status === "ML") {
            summary[record.name].ml += 1;
        }
    });

    for (const name in summary) {
        const present = summary[name].present;
        const absent = summary[name].absent;
        const ml = summary[name].ml;
        const total = present + absent + ml;
        const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

        summaryTable.innerHTML += `
            <tr>
                <td>${name}</td>
                <td>${present}</td>
                <td>${absent}</td>
                <td>${ml}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    }
}

async function submitLeave(event, type) {
    event.preventDefault();
    await ensureBackendData();

    const email = localStorage.getItem("loggedInUserEmail");
    const fromDate = document.getElementById("fromDate").value;
    const toDate = document.getElementById("toDate").value;
    const reason = document.getElementById("reason").value.trim();

    if (!email || !fromDate || !toDate || !reason) {
        alert("Please complete all leave details.");
        return;
    }

    if (fromDate > toDate) {
        alert("To date must be on or after from date.");
        return;
    }

    const payload = {
        leave_type: type,
        from_date: fromDate,
        to_date: toDate,
        reason,
        status: "Pending"
    };

    if (type === "student") {
        const student = readStorageArray("students").find(item => item.email === email);

        if (!student || !student.id) {
            alert("Student record not found. Please login again.");
            return;
        }

        payload.student = student.id;
    } else if (type === "faculty") {
        const faculty = readStorageArray("faculty").find(item => item.email === email);

        if (!faculty || !faculty.id) {
            alert("Faculty record not found. Please login again.");
            return;
        }

        payload.faculty = faculty.id;
    } else {
        alert("Unsupported leave type.");
        return;
    }

    await window.erpApi.leaves.create(payload);
    await syncBackendData();

    alert("Leave applied successfully.");

    const form = event.target && event.target.tagName === "FORM"
        ? event.target
        : document.querySelector("form");

    if (form) {
        form.reset();
    }
}

function applyLeave(event, type) {
    return submitLeave(event, type);
}

async function loadPendingLeaves() {
    await ensureBackendData();

    const leaves = readStorageArray("leaves");
    const table = document.getElementById("leaveTableBody");

    if (!table) return;

    table.innerHTML = "";

    const pendingLeaves = leaves.filter(leave => leave.status === "Pending");

    if (pendingLeaves.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6">No pending leave requests.</td>
            </tr>
        `;
        return;
    }

    pendingLeaves.forEach(leave => {
        table.innerHTML += `
            <tr>
                <td>${leave.name}</td>
                <td>${leave.type}</td>
                <td>${leave.fromDate}</td>
                <td>${leave.toDate}</td>
                <td>${leave.reason}</td>
                <td>
                    <button onclick="approveLeave(${leave.id})">Approve</button>
                    <button onclick="rejectLeave(${leave.id})">Reject</button>
                </td>
            </tr>
        `;
    });
}

async function approveLeave(id) {
    await ensureBackendData();

    const leaves = readStorageArray("leaves");
    const leave = leaves.find(item => item.id === id);

    if (!leave) {
        alert("Leave record not found.");
        return;
    }

    await window.erpApi.leaves.update(id, { status: "Approved" });

    const dateRange = getDateRange(leave.fromDate, leave.toDate);

    if (leave.type === "student" && leave.studentId) {
        const attendance = readStorageArray("attendance");

        for (const date of dateRange) {
            const existingRecord = attendance.find(record =>
                record.studentId === leave.studentId &&
                record.date === date
            );
            const payload = { student: leave.studentId, date, status: "ML" };

            if (existingRecord && existingRecord.id) {
                await window.erpApi.studentAttendance.update(existingRecord.id, payload);
            } else {
                await window.erpApi.studentAttendance.create(payload);
            }
        }
    }

    if (leave.type === "faculty" && leave.facultyId) {
        const staffAttendance = readStorageArray("staffAttendance");

        for (const date of dateRange) {
            const existingRecord = staffAttendance.find(record =>
                record.facultyId === leave.facultyId &&
                record.date === date
            );
            const payload = { faculty: leave.facultyId, date, status: "ML" };

            if (existingRecord && existingRecord.id) {
                await window.erpApi.staffAttendance.update(existingRecord.id, payload);
            } else {
                await window.erpApi.staffAttendance.create(payload);
            }
        }
    }

    await syncBackendData();

    alert("Leave approved and attendance updated.");

    await loadPendingLeaves();
}

async function loadLeaveStatus() {
    await ensureBackendData();

    const leaves = readStorageArray("leaves");
    const email = localStorage.getItem("loggedInUserEmail");
    const table = document.getElementById("leaveStatusTable");

    if (!table) return;

    table.innerHTML = "";

    const myLeaves = leaves.filter(leave => leave.email === email);

    if (myLeaves.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="4">No leave applied.</td>
            </tr>
        `;
        return;
    }

    myLeaves.forEach(leave => {
        let statusColor = "";

        if (leave.status === "Pending") {
            statusColor = "orange";
        } else if (leave.status === "Approved") {
            statusColor = "green";
        } else if (leave.status === "Rejected") {
            statusColor = "red";
        }

        table.innerHTML += `
            <tr>
                <td>${leave.fromDate}</td>
                <td>${leave.toDate}</td>
                <td>${leave.reason}</td>
                <td style="color:${statusColor}; font-weight:bold;">${leave.status}</td>
            </tr>
        `;
    });
}

async function rejectLeave(id) {
    await window.erpApi.leaves.update(id, { status: "Rejected" });
    await syncBackendData();

    alert("Leave rejected.");

    await loadPendingLeaves();
}

document.addEventListener("DOMContentLoaded", async () => {
    const addFacultyButton = document.getElementById("addFacultyButton");

    if (document.getElementById("facultyDistrict")) {
        populateFacultyDistricts();
        populateFacultyTalukas();
    }

    if (addFacultyButton && addFacultyButton.type === "button") {
        addFacultyButton.addEventListener("click", addFaculty);
    }

    highlightActiveNav();
    addAutoBackButton();
    showStoredLoginError();
    await checkBackendConnection();
    await ensureBackendData();

    const currentPage = window.location.pathname.split("/").pop().toLowerCase();
    const approvedStudentOnlyPages = new Set([
        "student.html",
        "student_semester_details.html",
        "student_subject_detail.html",
        "student_leave.html",
        "student_leave_status.html"
    ]);

    if (approvedStudentOnlyPages.has(currentPage) && !requireApprovedStudentAccess()) {
        return;
    }

    if (currentPage === "print_student.html" &&
        localStorage.getItem("loggedInRole") === "student" &&
        !requireApprovedStudentAccess()) {
        return;
    }

    await initializeRegistrationPage();
});
