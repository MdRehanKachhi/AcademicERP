const API_BASE_URL = "http://127.0.0.1:8000/api";

function getStudentSessionHeaders() {
    const loggedInEmail = localStorage.getItem("loggedInUserEmail");

    return loggedInEmail
        ? { "X-Student-Email": loggedInEmail }
        : {};
}

async function apiRequest(endpoint, options = {}) {
    const shouldAttachStudentHeader = endpoint.startsWith("/students/semester-subjects/") ||
        endpoint.startsWith("/students/subjects/");
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...(shouldAttachStudentHeader ? getStudentSessionHeaders() : {}),
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText || `Request failed with status ${response.status}`;

        try {
            const parsedError = JSON.parse(errorText);

            if (typeof parsedError === "string") {
                errorMessage = parsedError;
            } else if (parsedError && typeof parsedError === "object") {
                errorMessage = Object.entries(parsedError)
                    .map(([field, message]) => {
                        const normalizedMessage = Array.isArray(message) ? message.join(", ") : message;
                        return field === "detail" ? normalizedMessage : `${field}: ${normalizedMessage}`;
                    })
                    .join("\n");
            }
        } catch (_error) {
            // Keep the raw text when the response is not JSON.
        }

        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

const api = {
    health: () => apiRequest("/health/"),
    students: {
        list: () => apiRequest("/students/"),
        byClass: classId => apiRequest(`/students/by-class/${classId}/`),
        create: payload => apiRequest("/students/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/students/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }),
        remove: id => apiRequest(`/students/${id}/`, {
            method: "DELETE"
        })
    },
    faculty: {
        list: () => apiRequest("/faculty/"),
        create: payload => apiRequest("/faculty/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/faculty/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }),
        remove: id => apiRequest(`/faculty/${id}/`, {
            method: "DELETE"
        })
    },
    classes: {
        list: () => apiRequest("/classes/"),
        create: payload => apiRequest("/classes/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        remove: id => apiRequest(`/classes/${id}/`, {
            method: "DELETE"
        })
    },
    subjects: {
        list: () => apiRequest("/subjects/"),
        listByClass: classId => apiRequest(`/get-subjects-by-class/${encodeURIComponent(classId ?? "all")}/`),
        create: payload => apiRequest("/subjects/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/subjects/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }),
        remove: id => apiRequest(`/subjects/${id}/`, {
            method: "DELETE"
        })
    },
    assignments: {
        list: () => apiRequest("/assignments/"),
        listByClass: classId => apiRequest(`/class-subject-assignments/${classId ? `?class_id=${encodeURIComponent(classId)}` : ""}`),
        create: payload => apiRequest("/assignments/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/assignments/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        }),
        remove: id => apiRequest(`/assignments/${id}/`, {
            method: "DELETE"
        })
    },
    assignmentItems: {
        list: () => apiRequest("/assignment-items/"),
        create: payload => apiRequest("/assignment-items/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/assignment-items/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    submissions: {
        list: () => apiRequest("/submissions/"),
        create: payload => apiRequest("/submissions/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/submissions/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    leaves: {
        list: () => apiRequest("/leaves/"),
        create: payload => apiRequest("/leaves/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/leaves/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    marks: {
        list: () => apiRequest("/marks/"),
        create: payload => apiRequest("/marks/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/marks/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    studentAttendance: {
        list: () => apiRequest("/student-attendance/"),
        create: payload => apiRequest("/student-attendance/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/student-attendance/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    staffAttendance: {
        list: () => apiRequest("/staff-attendance/"),
        create: payload => apiRequest("/staff-attendance/", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        update: (id, payload) => apiRequest(`/staff-attendance/${id}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        })
    },
    studentSubjects: {
        list: () => apiRequest("/students/semester-subjects/"),
        detail: subjectId => apiRequest(`/students/subjects/${subjectId}/`)
    }
};

window.erpApi = api;
