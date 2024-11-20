import React, { useState } from "react";

// Define the interface for the MultiSelect component's props
interface MultiSelectProps {
  options: { value: string; label: string }[]; // List of options (label and value pairs)
  selectedValues: string[]; // List of currently selected values
  onChange: (selectedValues: string[]) => void; // Callback to handle changes in selected values
  placeholder?: string; // Optional placeholder text
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
}) => {
  // State to manage if the dropdown is open or closed
  const [isOpen, setIsOpen] = useState(false);

  // Toggle the dropdown's open/close state
  const toggleDropdown = () => setIsOpen(!isOpen);

  // Handle selection and unselection of an option
  const handleOptionClick = (value: string) => {
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value) // Remove if already selected
      : [...selectedValues, value]; // Add if not selected
    onChange(newSelectedValues); // Update the parent state with the new selected values
  };

  return (
    <div
      style={{
        width: "300px", // Fixed width for the container
        position: "sticky", // Ensure dropdown positioning is relative to this container
        height: "auto", // Allow height to expand, but keep the container position fixed
        zIndex: 10, // Ensure it stays on top
      }}
    >
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "5px",
          padding: "10px",
          cursor: "pointer",
        }}
        onClick={toggleDropdown}
      >
        <span>{selectedValues.length ? `${selectedValues.length} selected` : placeholder}</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%", // Position dropdown just below the input box
            left: "0",
            width: "100%",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "5px",
            marginTop: "5px",
            boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            maxHeight: "200px", // Limit dropdown height
            overflowY: "auto",
            zIndex: 10, // Ensure the dropdown is above other elements
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              style={{
                padding: "10px",
                backgroundColor: selectedValues.includes(option.value)
                  ? "#e0e0e0"
                  : "white",
                cursor: "pointer",
              }}
              onClick={() => handleOptionClick(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
