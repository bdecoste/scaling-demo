package org.cloudydemo.model;

import java.util.ArrayList;
import java.util.List;

public class Application {
	String name;
	final String type = "application";
	List<Gear> children = new ArrayList<Gear>();

	public Application(String name) {
		super();
		this.name = name;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getType() {
		return type;
	}

	@Override
	public String toString() {
		return "Application [name=" + name + "]";
	}

	public List<Gear> getChildren() {
		return children;
	}
}
