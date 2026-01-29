import React from "react";
import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const location = useLocation();

  return (
    <nav className="sidebar">
      <Link
        to="/"
        style={{
          color: location.pathname === "/" ? "#3498db" : "white",
          display: "block",
          marginBottom: "10px",
          textDecoration: "none",
        }}
      >
        Import
      </Link>

      <Link
        to="/records"
        style={{
          color: location.pathname === "/records" ? "#3498db" : "white",
          display: "block",
          marginBottom: "10px",
          textDecoration: "none",
        }}
      >
        View Table
      </Link>

      <Link
        to="/layouts"
        style={{
          color: location.pathname === "/layouts" ? "#3498db" : "white",
          display: "block",
          marginBottom: "10px",
          textDecoration: "none",
        }}
      >
        Manage Layout
      </Link>

      <Link
        to="/import-history"
        style={{
          color: location.pathname === "/import-history" ? "#3498db" : "white",
          display: "block",
          textDecoration: "none",
        }}
      >
        Import History
      </Link>

      <Link
        to="/kaizens"
        style={{
          color: location.pathname === "/kaizens" ? "#3498db" : "white",
          display: "block",
          marginBottom: "10px",
          textDecoration: "none",
        }}
      >
        Kaizen Data
      </Link>
    </nav>
  );
}

export default Sidebar;
