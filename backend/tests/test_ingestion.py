from pathlib import Path
from ingestion import IngestionEngine

def test_parse_txt_and_chunking():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "hr_policy.txt"
    assert sample_file.exists()

    pages = IngestionEngine.parse_txt(str(sample_file))
    assert len(pages) == 1
    assert "ANNUAL LEAVE" in pages[0]["text"]
    assert pages[0]["page_number"] == 1


def test_parse_csv_faq():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "faq_knowledge.csv"
    assert sample_file.exists()

    faq_pages = IngestionEngine.parse_csv(str(sample_file))
    assert len(faq_pages) >= 5
    assert "Question:" in faq_pages[0]["text"]
    assert "Answer:" in faq_pages[0]["text"]


def test_student_handbook_parsing():
    sample_file = Path(__file__).resolve().parent.parent / "sample_data" / "student_handbook.txt"
    assert sample_file.exists()

    pages = IngestionEngine.parse_txt(str(sample_file))
    assert len(pages) == 1
    assert "75%" in pages[0]["text"]


def test_parse_pdf():
    sample_pdf = Path(__file__).resolve().parent.parent / "sample_data" / "cloud_architecture.pdf"
    assert sample_pdf.exists()

    pages = IngestionEngine.parse_pdf(str(sample_pdf))
    assert len(pages) == 1
    assert "Infosys" in pages[0]["text"] or "Architecture" in pages[0]["text"]

