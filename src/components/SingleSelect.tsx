import React, { useState } from "react";

// Define the interface for the SingleSelect component's props
interface SingleSelectProps {
  options: { value: string; label: string }[]; // List of options (label and value pairs)
  selectedValue: string; // Currently selected value
  onChange: (selectedValue: string) => void; // Callback to handle changes in selected value
  placeholder?: string; // Optional placeholder text
}

const SingleSelect: React.FC<SingleSelectProps> = ({
  options,
  selectedValue,
  onChange,
  placeholder = "Select an option...",
}) => {
  // State to manage if the dropdown is open or closed
  const [isOpen, setIsOpen] = useState(false);

  // Toggle the dropdown's open/close state
  const toggleDropdown = () => setIsOpen(!isOpen);

  // Handle selection of an option
  const handleOptionClick = (value: string) => {
    onChange(value); // Update the parent state with the new selected value
    setIsOpen(false); // Close the dropdown after selection
  };

  return (
    <div style={{ width: "300px", position: "relative" }}>
      {/* Dropdown Trigger */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "5px",
          padding: "10px",
          cursor: "pointer",
        }}
        onClick={toggleDropdown}
      >
        <span>{selectedValue ? options.find((opt) => opt.value === selectedValue)?.label : placeholder}</span>
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "0",
            width: "100%",
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "5px",
            marginTop: "5px",
            boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              style={{
                padding: "10px",
                backgroundColor: selectedValue === option.value ? "#e0e0e0" : "white",
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

export default SingleSelect;
